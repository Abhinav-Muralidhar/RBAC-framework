/**
 * RoleService
 * 
 * Business logic for role management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */
import { TransactionTask } from '../utils/transaction.utils';
import { Roles } from '../models/roles.model';
import { IRoleRepository } from '../repositories/roles.repository';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';
import { IProfilesRepository } from '../repositories/profiles.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import {
    RoleNotFoundError,
    DuplicateAssignmentError,
    ProfileNotFoundError
} from '../errors/rbac.errors';
import { RoleListFilterDto, CreateRoleRequestDto, UpdateRoleRequestDto, RoleResponseDto, RoleNode } from '../dto/role.dto';
import { PaginationParams, PaginatedResult, normalizePaginationParams, buildPaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IRoleService {
    getById(t: TransactionTask, actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError>;
    listPaginated(t: TransactionTask, actingUserId: string, filters?: { parent_role_id?: string; is_active?: boolean; search?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
    getAncestors(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]>;
    getChildren(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]>;
    createRoleProfiles(t: TransactionTask, actingUserId: string, data: CreateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles>;
    updateRoleProfiles(t: TransactionTask, actingUserId: string, roleId: string, data: UpdateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles>;
    delete(t: TransactionTask, actingUserId: string, roleId: string, auditCtx?: AuditContext): Promise<void>;
    getUsersWithRole(t: TransactionTask, actingUserId: string, roleId: string): Promise<string[]>;
    getRoleTree(t: TransactionTask, actingUserId: string): Promise<RoleNode[]>
    assignRoleToUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void>;
    unassignRoleFromUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void>;
}

export class RoleService implements IRoleService {
    constructor(
        private roleRepository: IRoleRepository,
        private userRoleRepository: IUserRoleRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
        private profilesRepository: IProfilesRepository,
    ) { }

    async getById(t: TransactionTask, actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError> {
        const role = await this.roleRepository.findByIdWithDetails(t, roleId);
        if (!role) throw new RoleNotFoundError(roleId);
        return role;
    }

    async assignRoleToUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void> {
        const existing = await this.userRoleRepository.hasRole(t, userId, roleId);
        if (existing) throw new DuplicateAssignmentError(`role '${roleId}' to user '${userId}'`);
        await this.userRoleRepository.assign(t, userId, roleId, actingUserId);
    }

    async unassignRoleFromUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void> {
        await this.userRoleRepository.revoke(t, userId, roleId);
    }

    async listPaginated(t: TransactionTask,
        actingUserId: string,
        filters?: { parent_role_id?: string; is_active?: boolean; search?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Roles>> {
        const params = normalizePaginationParams(pagination);
        const result = await this.roleRepository.findAllPaginated(t, filters, params);
        return result;
    }

    async getAncestors(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]> {
        return this.roleRepository.findAncestors(t, roleId);
    }

    async getChildren(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]> {
        return this.roleRepository.findChildRoles(t, roleId);
    }

    async createRoleProfiles(t: TransactionTask, actingUserId: string, data: CreateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles> {
        const existing = await this.roleRepository.findByCode(t, data.code);
        if (existing) throw new DuplicateAssignmentError(`role code '${data.code}'`);

        const role = await this.roleRepository.create(t, {
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            parent_role_id: data.parent_role_id ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
        const profileIds = data.profile_ids ?? []; // convert null/undefined to empty array
        if (profileIds.length > 0) {
            const profiles = await this.profilesRepository.findByIds(t, profileIds);
            if (profiles.length !== profileIds.length) {
                const foundIds = new Set(profiles.map(p => p.id));
                const missing = profileIds.filter(id => !foundIds.has(id));
                throw new ProfileNotFoundError(missing.join(', '));
            }

            await this.roleProfilesRepository.assignAllByRole(t, role.id, profileIds, actingUserId);
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'role',
            entity_id: role.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return role;
    }

    async updateRoleProfiles(t: TransactionTask, actingUserId: string, roleId: string, data: UpdateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles> {
        const existing = await this.roleRepository.findById(t, roleId);
        if (!existing) throw new RoleNotFoundError(roleId);

        const role: Roles = {
            id: existing.id,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: data.description ?? existing.description as string | null,
            parent_role_id: data.parent_role_id ?? existing.parent_role_id as string | null,
            is_active: data.is_active ?? existing.is_active,
            created_by: existing.created_by as string | null,
            created_at: existing.created_at,
        }
        const updatedRole = await this.roleRepository.update(t, roleId, role);

        const profileIds = data.profile_ids ?? []; // convert null/undefined to empty array
        if (profileIds.length > 0) {
            const profiles = await this.profilesRepository.findByIds(t, profileIds);
            if (profiles.length !== profileIds.length) {
                const foundIds = new Set(profiles.map(p => p.id));
                const missing = profileIds.filter(id => !foundIds.has(id));
                throw new ProfileNotFoundError(missing.join(', '));
            }
            await this.roleProfilesRepository.assignAllByRole(t, role.id, profileIds, actingUserId);
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'role',
            entity_id: roleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...updatedRole } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return updatedRole;
    }


    async delete(t: TransactionTask, actingUserId: string, roleId: string, auditCtx?: AuditContext): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.roleRepository.findById(t, roleId);
        if (!existing) throw new RoleNotFoundError(roleId);

        const hasChildren = await this.roleRepository.hasActiveChildren(t, roleId);
        if (hasChildren) throw new Error('ROLE_HAS_ACTIVE_CHILDREN');

        await this.roleRepository.delete(t, roleId);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'role',
            entity_id: roleId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { deleted: true, user_id: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
    }

    async getUsersWithRole(t: TransactionTask, actingUserId: string, roleId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const userRoles = await this.userRoleRepository.findUsersByRole(t, roleId);
        return userRoles.map(ur => ur.user_id);
    }

    async getRoleTree(t: TransactionTask, actingUserId: string): Promise<RoleNode[]> {
        const rows = await this.roleRepository.findRoleTree(t);
        const map = new Map<string, RoleNode>();
        const roots: RoleNode[] = [];

        for (const row of rows) {
            map.set(row.id, { id: row.id, name: row.name, children: [], hasChildren: false });
        }

        for (const row of rows) {
            const node = map.get(row.id)!;
            if (!row.parent_role_id) {
                roots.push(node);
            } else {
                const parent = map.get(row.parent_role_id);
                if (parent) {
                    parent.children.push(node);
                    parent.hasChildren = true;
                }
            }
        }

        return roots;
    }
}
