/**
 * PermissionService
 * 
 * Business logic for permission management and profile-permission assignments.
 * 
 * OWNS: Permission CRUD, profile-permission assignments, role-profile assignments
 * DOES NOT OWN: Profile CRUD (see ProfileService), Role CRUD (see RoleService)
 * 
 * All mutating operations require RBAC enforcement.
 */

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
    RoleNotFoundError
} from '../errors/rbac.errors';
import { PermissionListFilterDto, CreatePermissionRequestDto, UpdatePermissionRequestDto } from '../dto/permission.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IPermissionService {
    // Permission CRUD
    getPermissionById(actingUserId: string, permissionId: string): Promise<Permissions>;
    getPermissionByModuleAction(actingUserId: string, moduleCode: string, action: PermissionAction): Promise<Permissions>;
    listPermissionsByModule(actingUserId: string, moduleCode: string): Promise<Permissions[]>;
    listAllPermissions(actingUserId: string): Promise<Permissions[]>;
    listPermissionsPaginated(actingUserId: string, filters?: PermissionListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Permissions>>;
    createPermission(actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions>;
    updatePermission(actingUserId: string, permissionId: string, data: UpdatePermissionRequestDto): Promise<Permissions>;
    deletePermission(actingUserId: string, permissionId: string): Promise<void>;

    // Profile-Permission assignments (links between profiles and permissions)
    assignPermissionToProfile(actingUserId: string, profileId: string, permissionId: string, effect: PermissionEffect): Promise<void>;
    revokePermissionFromProfile(actingUserId: string, profileId: string, permissionId: string): Promise<void>;
    getProfilePermissions(actingUserId: string, profileId: string): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>>;

    // Role-Profile assignments (links between roles and profiles)
    assignProfileToRole(actingUserId: string, profileId: string, roleId: string): Promise<void>;
    revokeProfileFromRole(actingUserId: string, profileId: string, roleId: string): Promise<void>;
    getRoleProfiles(actingUserId: string, roleId: string): Promise<Profiles[]>;
}

export class PermissionService implements IPermissionService {
    constructor(
        private permissionsRepository: IPermissionsRepository,
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private moduleRepository: IModuleRepository,
        private roleRepository: IRoleRepository,
        private evaluationService: IEvaluationService
    ) { }

    // ===================================
    // Permission CRUD
    // ===================================

    async getPermissionById(actingUserId: string, permissionId: string): Promise<Permissions> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const permission = await this.permissionsRepository.findById(permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }
        return permission;
    }

    async getPermissionByModuleAction(actingUserId: string, moduleCode: string, action: PermissionAction): Promise<Permissions> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const module = await this.moduleRepository.findByCode(moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        const permission = await this.permissionsRepository.findByModuleAndAction(module.id, action);
        if (!permission) {
            throw new PermissionNotFoundError(`${moduleCode}:${action}`);
        }
        return permission;
    }

    async listPermissionsByModule(actingUserId: string, moduleCode: string): Promise<Permissions[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const module = await this.moduleRepository.findByCode(moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        const allPermissions = await this.permissionsRepository.findAll();
        return allPermissions.filter(p => p.module_id === module.id);
    }

    async listAllPermissions(actingUserId: string): Promise<Permissions[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.permissionsRepository.findAll();
    }

    async listPermissionsPaginated(
        actingUserId: string,
        filters?: PermissionListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Permissions>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.permissionsRepository.findAllPaginated(filters, pagination);
    }

    async createPermission(actingUserId: string, data: CreatePermissionRequestDto): Promise<Permissions> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        const module = await this.moduleRepository.findById(data.module_id);
        if (!module) {
            throw new ModuleNotFoundError(data.module_id);
        }

        const existing = await this.permissionsRepository.findByModuleAndAction(data.module_id, data.action);
        if (existing) {
            throw new DuplicateAssignmentError(`permission ${data.action} for module ${data.module_id}`);
        }

        return this.permissionsRepository.create({
            module_id: data.module_id,
            action: data.action,
            description: data.description ?? null,
            is_active: data.is_active ?? true
        });
    }

    async updatePermission(actingUserId: string, permissionId: string, data: UpdatePermissionRequestDto): Promise<Permissions> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.permissionsRepository.findById(permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }

        return this.permissionsRepository.update(permissionId, data);
    }

    async deletePermission(actingUserId: string, permissionId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.permissionsRepository.findById(permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }

        return this.permissionsRepository.delete(permissionId);
    }

    // ===================================
    // Profile-Permission Assignments
    // ===================================

    async assignPermissionToProfile(
        actingUserId: string,
        profileId: string,
        permissionId: string,
        effect: PermissionEffect
    ): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        const permission = await this.permissionsRepository.findById(permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }

        const existingAssignment = await this.profilePermissionsRepository.findAssignment(profileId, permissionId);
        if (existingAssignment) {
            if (existingAssignment.effect !== effect) {
                await this.profilePermissionsRepository.updateEffect(profileId, permissionId, effect);
            }
            return;
        }

        await this.profilePermissionsRepository.assign(profileId, permissionId, effect);
    }

    async revokePermissionFromProfile(actingUserId: string, profileId: string, permissionId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilePermissionsRepository.revoke(profileId, permissionId);
    }

    async getProfilePermissions(
        actingUserId: string,
        profileId: string
    ): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const profilePermissions = await this.profilePermissionsRepository.findPermissionsByProfile(profileId);
        const result: Array<{ permission: Permissions; effect: PermissionEffect }> = [];

        for (const pp of profilePermissions) {
            const permission = await this.permissionsRepository.findById(pp.permission_id);
            if (permission) {
                result.push({ permission, effect: pp.effect });
            }
        }

        return result;
    }

    // ===================================
    // Role-Profile Assignments
    // ===================================

    async assignProfileToRole(actingUserId: string, profileId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        const hasProfile = await this.roleProfilesRepository.hasProfile(roleId, profileId);
        if (hasProfile) {
            return; // Idempotent
        }

        await this.roleProfilesRepository.assign(roleId, profileId, actingUserId);
    }

    async revokeProfileFromRole(actingUserId: string, profileId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.roleProfilesRepository.revoke(roleId, profileId);
    }

    async getRoleProfiles(actingUserId: string, roleId: string): Promise<Profiles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const roleProfiles = await this.roleProfilesRepository.findProfilesByRole(roleId);
        const profiles: Profiles[] = [];

        for (const rp of roleProfiles) {
            const profile = await this.profilesRepository.findById(rp.profile_id);
            if (profile) {
                profiles.push(profile);
            }
        }

        return profiles;
    }
}
