/**
 * RoleService
 * 
 * Business logic for role management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */
import { IDatabase } from 'pg-promise';
import { withTransaction } from '../utils/transaction.utils';
import { Roles } from '../models/roles.model';
import { IRoleRepository } from '../repositories/roles.repository';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import {
    RoleNotFoundError,
    DuplicateAssignmentError,
    ProfileNotFoundError
} from '../errors/rbac.errors';
import { RoleListFilterDto, CreateRoleRequestDto, UpdateRoleRequestDto, RoleResponseDto } from '../dto/role.dto';
import { PaginationParams, PaginatedResult, normalizePaginationParams, buildPaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IRoleService {
    getById(actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError>;
    listPaginated(actingUserId: string, filters?: RoleListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
    getAncestors(actingUserId: string, roleId: string): Promise<Roles[]>;
    getChildren(actingUserId: string, roleId: string): Promise<Roles[]>;
    createRoleProfiles(actingUserId: string, data: CreateRoleRequestDto): Promise<Roles>;
    updateRoleProfiles(actingUserId: string, roleId: string, data: UpdateRoleRequestDto): Promise<Roles>;
    delete(actingUserId: string, roleId: string): Promise<void>;
    getUsersWithRole(actingUserId: string, roleId: string): Promise<string[]>;
}

export class RoleService implements IRoleService {
    constructor(
        private roleRepository: IRoleRepository,
        private userRoleRepository: IUserRoleRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
        private db: IDatabase<unknown>,
    ) { }

    async getById(actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return withTransaction(this.db, async (t) => {
            const role = await this.roleRepository.findByIdWithDetails(t, roleId);
            if (!role) throw new RoleNotFoundError(roleId);
            return role;
        });
    }

    async listPaginated(
        actingUserId: string,
        filters?: RoleListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Roles>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return withTransaction(this.db, async (t) => {
            const params = normalizePaginationParams(pagination);
            const result = await this.roleRepository.findAllPaginated(t, filters, params);
            return result;
        });
    }

    async getAncestors(actingUserId: string, roleId: string): Promise<Roles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return withTransaction(this.db, async (t) => {
            return this.roleRepository.findAncestors(t, roleId);
        });
    }

    async getChildren(actingUserId: string, roleId: string): Promise<Roles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return withTransaction(this.db, async (t) => {
            return this.roleRepository.findChildRoles(t, roleId);
        });
    }

    async createRoleProfiles(actingUserId: string, data: CreateRoleRequestDto): Promise<Roles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');
        return withTransaction(this.db, async (t) => {
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
                const profiles = await this.roleProfilesRepository.findByIds(t, profileIds);
                if (profiles.length !== profileIds.length) {
                    const foundIds = new Set(profiles.map(p => p.profile_id));
                    const missing = profileIds.filter(id => !foundIds.has(id));
                    throw new ProfileNotFoundError(missing.join(', '));
                }

                await this.roleProfilesRepository.assignAllByRole(t, role.id, profileIds, actingUserId);
            }

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'create',
                entity_type: 'role',
                entity_id: role.id,
                old_values: null,
                new_values: { ...data },
                status: 'success'
            }).catch(console.error);

            return role;
        });
    }

    async updateRoleProfiles(actingUserId: string, roleId: string, data: UpdateRoleRequestDto): Promise<Roles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        return withTransaction(this.db, async (t) => {
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
                const profiles = await this.roleProfilesRepository.findByIds(t, profileIds);
                if (profiles.length !== profileIds.length) {
                    const foundIds = new Set(profiles.map(p => p.profile_id));
                    const missing = profileIds.filter(id => !foundIds.has(id));
                    throw new ProfileNotFoundError(missing.join(', '));
                }
                await this.roleProfilesRepository.assignAllByRole(t, role.id, profileIds, actingUserId);
            }

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'update',
                entity_type: 'role',
                entity_id: roleId,
                old_values: { ...existing },
                new_values: { ...data },
                status: 'success'
            }).catch(console.error);

            return updatedRole;
        });
    }


    async delete(actingUserId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');
        return withTransaction(this.db, async (t) => {
            const existing = await this.roleRepository.findById(t, roleId);
            if (!existing) throw new RoleNotFoundError(roleId);

            await this.roleRepository.delete(t, roleId);

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'delete',
                entity_type: 'role',
                entity_id: roleId,
                old_values: { ...existing },
                new_values: { is_deleted: true },
                status: 'success'
            }).catch(console.error);
        });
    }

    async getUsersWithRole(actingUserId: string, roleId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return withTransaction(this.db, async (t) => {
            const userRoles = await this.userRoleRepository.findUsersByRole(t, roleId);
            return userRoles.map(ur => ur.user_id);
        });
    }
}
