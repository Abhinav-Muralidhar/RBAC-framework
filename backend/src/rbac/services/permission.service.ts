/**
 * PermissionService
 *
 * Business logic for permission CRUD, profile-permission assignments,
 * and role-profile associations.
 * All mutating operations are audit-logged.
 */
import { TransactionTask } from '../../utils/transaction.utils';
import { Permissions, PermissionAction } from '../models/permissions.model';
import { Profiles } from '../models/profiles.model';
import { PermissionEffect } from '../models/profile_permissions.model';
import { IPermissionsRepository } from '../repositories/permissions.repository';
import { IProfilesRepository } from '../repositories/profiles.repository';
import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';
import { IProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { IModuleRepository } from '../repositories/modules.repository';
import { IRoleRepository } from '../repositories/roles.repository';
import { IEvaluationService } from './evaluation.service';
import {
    PermissionNotFoundError,
    ProfileNotFoundError,
    DuplicateAssignmentError,
    ModuleNotFoundError,
    RoleNotFoundError,
} from '../errors/rbac.errors';
import {
    CreatePermissionRequestDto,
    UpdatePermissionRequestDto
} from '../dto/permission.dto';
import { IAuditService } from './audit.service';
import { assertRequiredString, assertOptionalString, assertInEnum } from '../../utils/validators';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IPermissionService {
    /** Retrieve a single permission by ID. */
    getPermissionById(t: TransactionTask, actingUserId: string, permissionId: string): Promise<Permissions>;
    /** Retrieve a permission by module code and action (e.g. SETTINGS:read). */
    getPermissionByModuleAction(t: TransactionTask, actingUserId: string, moduleCode: string, action: PermissionAction): Promise<Permissions>;
    /** List all permissions belonging to a specific module. */
    listPermissionsByModule(t: TransactionTask, actingUserId: string, moduleCode: string): Promise<Permissions[]>;
    /** List all permissions with optional filters (module, action, active status). */
    listAllPermissions(t: TransactionTask, actingUserId: string, filters?: {
        module_id?: string;
        module_ids?: string[];
        action?: PermissionAction;
        actions?: PermissionAction[];
        is_active?: boolean;
    }): Promise<Permissions[]>;
    /** Create a new permission for a module/action combination. */
    createPermission(t: TransactionTask, actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions>;
    /** Update a permission's description or active status. */
    updatePermission(t: TransactionTask, actingUserId: string, permissionId: string, data: UpdatePermissionRequestDto): Promise<Permissions>;
    /** Hard-delete a permission. */
    deletePermission(t: TransactionTask, actingUserId: string, permissionId: string): Promise<void>;

    /** Get all permissions assigned to a profile, each with its effect (allow/deny). */
    getProfilePermissions(t: TransactionTask, actingUserId: string, profileId: string): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>>;

    /** Bulk-assign profiles to a role, replacing any existing assignments. */
    assignProfilesToRole(t: TransactionTask, actingUserId: string, profileIds: string[], roleId: string, auditCtx?: AuditContext): Promise<void>;
    /** Remove a single profile from a role. */
    revokeProfileFromRole(t: TransactionTask, actingUserId: string, profileId: string, roleId: string, auditCtx?: AuditContext): Promise<void>;
    /** Get all profiles currently assigned to a role. */
    getRoleProfiles(t: TransactionTask, actingUserId: string, roleId: string): Promise<Profiles[]>;
}

export class PermissionService implements IPermissionService {
    constructor(
        private permissionsRepository: IPermissionsRepository,
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private moduleRepository: IModuleRepository,
        private roleRepository: IRoleRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
    ) { }

    /**
     * Retrieve a single permission by its ID.
     * @throws PermissionNotFoundError if permission does not exist.
     */
    async getPermissionById(t: TransactionTask, actingUserId: string, permissionId: string): Promise<Permissions> {

        const permission = await this.permissionsRepository.findById(t, permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }
        return permission;
    }

    /**
     * Retrieve a permission by module code + action (e.g. 'SETTINGS' + 'read').
     * Resolves the module by code first, then finds the matching permission.
     * @throws ModuleNotFoundError if module code is invalid.
     * @throws PermissionNotFoundError if no permission exists for the module/action.
     */
    async getPermissionByModuleAction(t: TransactionTask, actingUserId: string, moduleCode: string, action: PermissionAction): Promise<Permissions> {
        const module = await this.moduleRepository.findByCode(t, moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        const permission =
            await this.permissionsRepository.findByModuleAndAction(t, module.id, action);
        if (!permission) {
            throw new PermissionNotFoundError(`${moduleCode}:${action}`);
        }
        return permission;
    }

    /**
     * List all permissions belonging to a specific module (resolved by code).
     * @throws ModuleNotFoundError if module code is invalid.
     */
    async listPermissionsByModule(t: TransactionTask, actingUserId: string, moduleCode: string): Promise<Permissions[]> {

        const module = await this.moduleRepository.findByCode(t, moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        return this.permissionsRepository.findAll(t, { module_id: module.id });
    }

    /** List all permissions with optional module/action/active filters. */
    async listAllPermissions(t: TransactionTask, actingUserId: string, filters?: {
        module_id?: string;
        module_ids?: string[];
        action?: PermissionAction;
        actions?: PermissionAction[];
        is_active?: boolean;
    }): Promise<Permissions[]> {
        return this.permissionsRepository.findAll(t, filters);
    }

    /**
     * Create a new permission for a module/action pair.
     * Validates the module exists and checks for duplicate module/action.
     * @throws ModuleNotFoundError if the module is invalid.
     * @throws DuplicateAssignmentError if the action already exists for this module.
     */
    async createPermission(t: TransactionTask, actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions> {
        assertRequiredString(data.module_id, 'Module ID');
        assertInEnum(data.action, ['create', 'read', 'update', 'delete', 'export'], 'Action');
        assertOptionalString(data.description, 'Description');


        const module = await this.moduleRepository.findById(t, data.module_id);
        if (!module) {
            throw new ModuleNotFoundError(data.module_id);
        }

        const existing =
            await this.permissionsRepository.findByModuleAndAction(
                t,
                data.module_id,
                data.action
            );
        if (existing) {
            throw new DuplicateAssignmentError(
                `permission ${data.action} for module ${data.module_id}`
            );
        }

        return this.permissionsRepository.create(t, {
            module_id: data.module_id,
            action: data.action,
            description: data.description ?? null
        });
    }

    /**
     * Update a permission's description or active status.
     * @throws PermissionNotFoundError if permission does not exist.
     */
    async updatePermission(
        t: TransactionTask,
        actingUserId: string,
        permissionId: string,
        data: UpdatePermissionRequestDto
    ): Promise<Permissions> {
        assertOptionalString(data.description, 'Description');


        const existing = await this.permissionsRepository.findById(t, permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }
        const da: Permissions = {
            id: permissionId,
            action: existing.action,
            module_id: existing.module_id,
            description: data.description ?? existing.description as string | null,
            is_active: data.is_active ?? existing.is_active
        }

        return this.permissionsRepository.update(t, permissionId, da);
    }

    /**
     * Hard-delete a permission.
     * @throws PermissionNotFoundError if permission does not exist.
     */
    async deletePermission(t: TransactionTask, actingUserId: string, permissionId: string): Promise<void> {
        const existing = await this.permissionsRepository.findById(t, permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }

        await this.permissionsRepository.delete(t, permissionId);
    }

    async getProfilePermissions(
        t: TransactionTask,
        actingUserId: string,
        profileId: string
    ): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>> {

        const profilePermissions =
            await this.profilePermissionsRepository.findPermissionsByProfile(t, profileId);

        if (profilePermissions.length === 0) return [];

        const permIds = profilePermissions.map(pp => pp.permission_id);
        const permissions = await this.permissionsRepository.findByIds(t, permIds);
        const permMap = new Map(permissions.map(p => [p.id, p]));

        const result: Array<{ permission: Permissions; effect: PermissionEffect }> = [];
        for (const pp of profilePermissions) {
            const permission = permMap.get(pp.permission_id);
            if (permission) {
                result.push({ permission: permission as unknown as Permissions, effect: pp.effect });
            }
        }
        return result;
    }

    // ===================================
    // Role-Profile Assignments
    // ===================================

    /**
     * Bulk-assign profiles to a role.
     * Validates that both the role and all profiles exist.
     * @throws RoleNotFoundError if the role does not exist.
     * @throws ProfileNotFoundError if any profile ID is invalid.
     */
    async assignProfilesToRole(
        t: TransactionTask,
        actingUserId: string,
        profileIds: string[],
        roleId: string,
        auditCtx?: AuditContext
    ): Promise<void> {

        //throw error if role doesnt exist
        const role = await this.roleRepository.findById(t, roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        const profiles = await this.profilesRepository.findByIds(t, profileIds);
        if (profiles.length !== profileIds.length) {
            const foundIds = new Set(profiles.map(p => p.id));
            const missing = profileIds.filter(id => !foundIds.has(id));
            throw new ProfileNotFoundError(missing.join(', '));
        }

        await this.roleProfilesRepository.assignAllByRole(t, roleId, profileIds, actingUserId);
        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'role_profile',
            entity_id: `${roleId}:${profileIds.join(',')}`,
            old_values: null,
            new_values: { role_id: roleId, profile_ids: profileIds, effect: 'allow' },
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }

    /**
     * Remove a single profile from a role.
     * @throws ProfileNotFoundError if the profile does not exist.
     * @throws RoleNotFoundError if the role does not exist.
     */
    async revokeProfileFromRole(
        t: TransactionTask,
        actingUserId: string,
        profileId: string,
        roleId: string,
        auditCtx?: AuditContext
    ): Promise<void> {

        const profile = await this.profilesRepository.findById(t, profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        const role = await this.roleRepository.findById(t, roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.roleProfilesRepository.revoke(t, roleId, profileId);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'role_profile',
            entity_id: `${roleId}:${profileId}`,
            old_values: { role_id: roleId, profile_id: profileId },
            new_values: {},
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
    }

    async getRoleProfiles(
        t: TransactionTask,
        actingUserId: string,
        roleId: string
    ): Promise<Profiles[]> {
        const roleProfiles =
            await this.roleProfilesRepository.findProfilesByRole(t, roleId);

        if (roleProfiles.length === 0) return [];

        const profileIds = roleProfiles.map(rp => rp.profile_id);
        const profiles = await this.profilesRepository.findByIds(t, profileIds);

        return profiles;
    }
}
