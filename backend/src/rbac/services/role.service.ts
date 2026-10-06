/**
 * RoleService
 *
 * Business logic for role management including CRUD, hierarchy traversal,
 * profile assignments, and user-role associations.
 * All mutating operations are audit-logged.
 */
import { TransactionTask } from '../../utils/transaction.utils';
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
    ProfileNotFoundError,
    RoleHasActiveChildrenError,
    CircularRoleHierarchyError,
    ValidationError
} from '../errors/rbac.errors';
import { RoleListFilterDto, CreateRoleRequestDto, UpdateRoleRequestDto, RoleResponseDto, RoleNode } from '../dto/role.dto';
import { PaginationParams, PaginatedResult, normalizePaginationParams, buildPaginatedResult } from '../../utils/pagination.utils';
import { assertRequiredString, assertOptionalString, assertCodeFormat, normalizeStringArray } from '../../utils/validators';

/** Module code used for RBAC permission checks on role operations. */
const MODULE_CODE = 'SETTINGS';

/** Maximum number of profile IDs that can be assigned to a single role in one request. */
const MAX_ROLE_PROFILE_IDS = 50;

export interface IRoleService {
    /** Retrieve a single role by ID, including associated profiles and audit names. */
    getById(t: TransactionTask, actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError>;
    /** List roles with optional filters and pagination. */
    listPaginated(t: TransactionTask, actingUserId: string, filters?: { parent_role_id?: string; is_active?: boolean; search?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
    /** Retrieve all ancestor roles up the hierarchy (with cycle detection). */
    getAncestors(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]>;
    /** Retrieve direct child roles of the given role. */
    getChildren(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]>;
    /** Create a new role and optionally assign profiles to it. */
    createRoleProfiles(t: TransactionTask, actingUserId: string, data: CreateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles>;
    /** Update an existing role and optionally reassign profiles. */
    updateRoleProfiles(t: TransactionTask, actingUserId: string, roleId: string, data: UpdateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles>;
    /** Soft-delete a role (only if it has no active children). */
    delete(t: TransactionTask, actingUserId: string, roleId: string, auditCtx?: AuditContext): Promise<void>;
    /** Get the list of user IDs assigned to a specific role. */
    getUsersWithRole(t: TransactionTask, actingUserId: string, roleId: string): Promise<string[]>;
    /** Build a full hierarchical tree of all roles (root → children). */
    getRoleTree(t: TransactionTask, actingUserId: string): Promise<RoleNode[]>
    /** Assign a role to a user (fails if already assigned). */
    assignRoleToUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void>;
    /** Remove a role from a user. */
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

    /**
     * Fetch a single role by ID with its associated profiles and audit-field names.
     * @throws RoleNotFoundError if the role does not exist.
     */
    async getById(t: TransactionTask, actingUserId: string, roleId: string): Promise<RoleResponseDto | RoleNotFoundError> {
        const role = await this.roleRepository.findByIdWithDetails(t, roleId);
        if (!role) throw new RoleNotFoundError(roleId);
        return role;
    }

    /**
     * Assign a role to a user.
     * @throws DuplicateAssignmentError if the user already has this role.
     */
    async assignRoleToUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void> {
        const existing = await this.userRoleRepository.hasRole(t, userId, roleId);
        if (existing) throw new DuplicateAssignmentError(`role '${roleId}' to user '${userId}'`);
        await this.userRoleRepository.assign(t, userId, roleId, actingUserId);
    }

    /** Remove a role from a user. */
    async unassignRoleFromUser(t: TransactionTask, actingUserId: string, roleId: string, userId: string): Promise<void> {
        await this.userRoleRepository.revoke(t, userId, roleId);
    }

    /** List roles with optional filters (parent, active, search) and pagination. */
    async listPaginated(t: TransactionTask,
        actingUserId: string,
        filters?: { parent_role_id?: string; is_active?: boolean; search?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Roles>> {
        const params = normalizePaginationParams(pagination);
        const result = await this.roleRepository.findAllPaginated(t, filters, params);
        return result;
    }

    /**
     * Walk up the role hierarchy and return all ancestor roles.
     * Uses path-based cycle detection to prevent infinite loops.
     */
    async getAncestors(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]> {
        return this.roleRepository.findAncestors(t, roleId);
    }

    /** Retrieve all direct child roles of a given parent role. */
    async getChildren(t: TransactionTask, actingUserId: string, roleId: string): Promise<Roles[]> {
        return this.roleRepository.findChildRoles(t, roleId);
    }

    /**
     * Create a new role and optionally assign profiles to it.
     *
     * Validates name, code, description, parent role. Checks for code uniqueness.
     * Verifies each profile ID exists before assignment.
     * @throws DuplicateAssignmentError if role code already exists.
     * @throws ProfileNotFoundError if any profile ID is invalid.
     * @throws ValidationError if profile_ids exceeds MAX_ROLE_PROFILE_IDS.
     */
    async createRoleProfiles(t: TransactionTask, actingUserId: string, data: CreateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles> {
        assertRequiredString(data.name, 'Role name');
        assertRequiredString(data.code, 'Role code');
        assertCodeFormat(data.code, 'Role code');
        assertOptionalString(data.description, 'Role description');
        assertOptionalString(data.parent_role_id, 'Parent role');
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
        const profileIds = normalizeStringArray(data.profile_ids, 'profile_ids');
        if (profileIds.length > MAX_ROLE_PROFILE_IDS) {
            throw new ValidationError('profile_ids', `Too many profile_ids (max ${MAX_ROLE_PROFILE_IDS})`);
        }
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

    /**
     * Update an existing role's attributes and optionally reassign its profiles.
     *
     * Validates all input fields. Guards against circular hierarchy by checking
     * the ancestor chain of the proposed parent role.
     * @throws RoleNotFoundError if the role does not exist.
     * @throws CircularRoleHierarchyError if setting parent would create a cycle.
     * @throws ProfileNotFoundError if any profile ID is invalid.
     * @throws ValidationError if profile_ids exceeds MAX_ROLE_PROFILE_IDS.
     */
    async updateRoleProfiles(t: TransactionTask, actingUserId: string, roleId: string, data: UpdateRoleRequestDto, auditCtx?: AuditContext): Promise<Roles> {
        if (data.name !== undefined) {
            assertRequiredString(data.name, 'Role name');
        }
        if (data.code !== undefined) {
            assertRequiredString(data.code, 'Role code');
            assertCodeFormat(data.code, 'Role code');
        }
        assertOptionalString(data.description, 'Role description');
        assertOptionalString(data.parent_role_id, 'Parent role');
        const existing = await this.roleRepository.findById(t, roleId);
        if (!existing) throw new RoleNotFoundError(roleId);

        if (data.parent_role_id) {
            if (data.parent_role_id === roleId) {
                throw new CircularRoleHierarchyError(roleId, data.parent_role_id);
            }
            const ancestors = await this.roleRepository.findAncestors(t, data.parent_role_id);
            if (ancestors.some(a => a.id === roleId)) {
                throw new CircularRoleHierarchyError(roleId, data.parent_role_id);
            }
        }

        const role: Roles = {
            id: existing.id,
            version: data.version,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: data.description ?? existing.description as string | null,
            parent_role_id: data.parent_role_id !== undefined
                ? data.parent_role_id
                : existing.parent_role_id as string | null,
            is_active: data.is_active ?? existing.is_active,
            created_by: existing.created_by as string | null,
            created_at: existing.created_at,
            updated_by: actingUserId,
        }
        const updatedRole = await this.roleRepository.update(t, roleId, role);

        const profileIds = normalizeStringArray(data.profile_ids, 'profile_ids');
        if (profileIds.length > MAX_ROLE_PROFILE_IDS) {
            throw new ValidationError('profile_ids', `Too many profile_ids (max ${MAX_ROLE_PROFILE_IDS})`);
        }
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


    /**
     * Soft-delete a role after verifying it has no active child roles.
     * Requires 'delete' permission on the SETTINGS module.
     * @throws RoleNotFoundError if the role does not exist.
     * @throws RoleHasActiveChildrenError if the role has active child roles.
     */
    async delete(t: TransactionTask, actingUserId: string, roleId: string, auditCtx?: AuditContext): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete', t);

        const existing = await this.roleRepository.findById(t, roleId);
        if (!existing) throw new RoleNotFoundError(roleId);

        const hasChildren = await this.roleRepository.hasActiveChildren(t, roleId);
        if (hasChildren) throw new RoleHasActiveChildrenError(roleId);

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

    /**
     * Get all user IDs currently assigned to a given role.
     * Requires 'read' permission on the SETTINGS module.
     */
    async getUsersWithRole(t: TransactionTask, actingUserId: string, roleId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read', t);
        const userRoles = await this.userRoleRepository.findUsersByRole(t, roleId);
        return userRoles.map(ur => ur.user_id);
    }

    /**
     * Build a hierarchical tree of all roles in the system.
     * Returns an array of root-level RoleNodes, each containing nested children.
     * Uses a Map for O(n) tree construction.
     */
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
