/**
 * PermissionService
 * 
 * Business logic for permission management and profile-permission assignments.
 * 
 * Permission CRUD, profile-permission assignments, role-profile assignments
 * 
 * All mutating operations require RBAC enforcement.
 */
import { TransactionTask } from '../utils/transaction.utils';
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

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IPermissionService {
    getPermissionById(t: TransactionTask, actingUserId: string, permissionId: string): Promise<Permissions>;
    getPermissionByModuleAction(t: TransactionTask, actingUserId: string, moduleCode: string, action: PermissionAction): Promise<Permissions>;
    listPermissionsByModule(t: TransactionTask, actingUserId: string, moduleCode: string): Promise<Permissions[]>;
    listAllPermissions(t: TransactionTask, actingUserId: string, filters?: { module_id?: string; action?: PermissionAction; }): Promise<Permissions[]>;
    createPermission(t: TransactionTask, actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions>;
    updatePermission(t: TransactionTask, actingUserId: string, permissionId: string, data: UpdatePermissionRequestDto): Promise<Permissions>;
    deletePermission(t: TransactionTask, actingUserId: string, permissionId: string): Promise<void>;

    // Profile-Permission assignments (links between profiles and permissions)
    getProfilePermissions(t: TransactionTask, actingUserId: string, profileId: string): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>>;

    // Role-Profile assignments (links between roles and profiles)
    assignProfilesToRole(t: TransactionTask, actingUserId: string, profileIds: string[], roleId: string, auditCtx?: AuditContext): Promise<void>;
    revokeProfileFromRole(t: TransactionTask, actingUserId: string, profileId: string, roleId: string, auditCtx?: AuditContext): Promise<void>;
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

    async getPermissionById(t: TransactionTask, actingUserId: string, permissionId: string): Promise<Permissions> {

        const permission = await this.permissionsRepository.findById(t, permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }
        return permission;
    }

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

    async listPermissionsByModule(t: TransactionTask, actingUserId: string, moduleCode: string): Promise<Permissions[]> {

        const module = await this.moduleRepository.findByCode(t, moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        const allPermissions = await this.permissionsRepository.findAll(t);
        return allPermissions.filter(p => p.module_id === module.id);
    }

    async listAllPermissions(t: TransactionTask, actingUserId: string, filters?: { module_id?: string; action?: PermissionAction; }): Promise<Permissions[]> {
        return this.permissionsRepository.findAll(t, filters);
    }

    async createPermission(t: TransactionTask, actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions> {


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

    async updatePermission(
        t: TransactionTask,
        actingUserId: string,
        permissionId: string,
        data: UpdatePermissionRequestDto
    ): Promise<Permissions> {


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

        const result: Array<{ permission: Permissions; effect: PermissionEffect }> = [];

        for (const pp of profilePermissions) {
            const permission = await this.permissionsRepository.findById(
                t,
                pp.permission_id
            );
            if (permission) {
                result.push({ permission, effect: pp.effect });
            }
        }
        return result;
    }

    // ===================================
    // Role-Profile Assignments
    // ===================================

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

        const profiles: Profiles[] = [];

        for (const rp of roleProfiles) {
            const profile = await this.profilesRepository.findById(
                t,
                rp.profile_id
            );
            if (profile) {
                profiles.push(profile);
            }
        }

        return profiles;
    }
}
