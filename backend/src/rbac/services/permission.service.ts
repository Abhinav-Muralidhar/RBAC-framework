/**
 * PermissionService
 * 
 * Business logic for permission and profile management.
 * NO permission evaluation logic here.
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
import {
    PermissionNotFoundError,
    ProfileNotFoundError,
    DuplicateAssignmentError,
    ModuleNotFoundError,
    RoleNotFoundError
} from '../errors/rbac.errors';

export interface IPermissionService {
    /**
     * Get permission by ID
     * @throws PermissionNotFoundError
     */
    getPermissionById(permissionId: string): Promise<Permissions>;

    /**
     * Get permission by module and action
     * @throws PermissionNotFoundError
     */
    getPermissionByModuleAction(
        moduleCode: string,
        action: PermissionAction
    ): Promise<Permissions>;

    /**
     * List all permissions for module
     */
    listPermissionsByModule(moduleCode: string): Promise<Permissions[]>;

    /**
     * List all permissions in organization
     */
    listAllPermissions(): Promise<Permissions[]>;

    /**
     * Create permission
     * @throws DuplicateAssignmentError
     * @throws ModuleNotFoundError
     */
    createPermission(
        data: {
            module_id: string;
            action: PermissionAction;
            description?: string;
            is_active?: boolean;
        }
    ): Promise<Permissions>;

    /**
     * Update permission
     * @throws PermissionNotFoundError
     */
    updatePermission(
        permissionId: string,
        data: Partial<Permissions>
    ): Promise<Permissions>;

    /**
     * Delete permission
     * @throws PermissionNotFoundError
     */
    deletePermission(permissionId: string): Promise<void>;

    /**
     * Get profile by ID
     * @throws ProfileNotFoundError
     */
    getProfileById(profileId: string): Promise<Profiles>;

    /**
     * Get profile by code
     * @throws ProfileNotFoundError
     */
    getProfileByCode(code: string): Promise<Profiles>;

    /**
     * List all profiles
     */
    listAllProfiles(): Promise<Profiles[]>;

    /**
     * Create profile
     * @throws DuplicateAssignmentError
     */
    createProfile(
        data: {
            name: string;
            code: string;
            description?: string;
            is_active?: boolean;
        },
        createdBy?: string
    ): Promise<Profiles>;

    /**
     * Update profile
     * @throws ProfileNotFoundError
     */
    updateProfile(
        profileId: string,
        data: Partial<Profiles>
    ): Promise<Profiles>;

    /**
     * Delete profile
     * @throws ProfileNotFoundError
     */
    deleteProfile(profileId: string): Promise<void>;

    /**
     * Assign permission to profile with effect
     * @throws ProfileNotFoundError
     * @throws PermissionNotFoundError
     * @throws DuplicateAssignmentError
     */
    assignPermissionToProfile(
        profileId: string,
        permissionId: string,
        effect: PermissionEffect
    ): Promise<void>;

    /**
     * Revoke permission from profile
     * @throws ProfileNotFoundError
     * @throws PermissionNotFoundError
     */
    revokePermissionFromProfile(
        profileId: string,
        permissionId: string
    ): Promise<void>;

    /**
     * Assign profile to role
     * @throws ProfileNotFoundError
     * @throws RoleNotFoundError
     * @throws DuplicateAssignmentError
     */
    assignProfileToRole(
        profileId: string,
        roleId: string,
        assignedBy?: string
    ): Promise<void>;

    /**
     * Revoke profile from role
     * @throws ProfileNotFoundError
     * @throws RoleNotFoundError
     */
    revokeProfileFromRole(
        profileId: string,
        roleId: string
    ): Promise<void>;

    /**
     * Get all permissions for a profile
     */
    getProfilePermissions(profileId: string): Promise<Array<{
        permission: Permissions;
        effect: PermissionEffect;
    }>>;

    /**
     * Get all profiles for a role
     */
    getRoleProfiles(roleId: string): Promise<Profiles[]>;
}

/**
 * PermissionService implementation
 */
export class PermissionService implements IPermissionService {
    constructor(
        private permissionsRepository: IPermissionsRepository,
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private moduleRepository: IModuleRepository,
        private roleRepository: IRoleRepository
    ) { }

    async getPermissionById(permissionId: string): Promise<Permissions> {
        const permission = await this.permissionsRepository.findById(permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }
        return permission;
    }

    async getPermissionByModuleAction(moduleCode: string, action: PermissionAction): Promise<Permissions> {
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

    async listPermissionsByModule(moduleCode: string): Promise<Permissions[]> {
        const module = await this.moduleRepository.findByCode(moduleCode);
        if (!module) {
            throw new ModuleNotFoundError(moduleCode);
        }

        const allPermissions = await this.permissionsRepository.findAll();
        return allPermissions.filter(p => p.module_id === module.id);
    }

    async listAllPermissions(): Promise<Permissions[]> {
        return this.permissionsRepository.findAll();
    }

    async createPermission(data: {
        module_id: string;
        action: PermissionAction;
        description?: string;
        is_active?: boolean;
    }): Promise<Permissions> {
        // Check that module exists
        const module = await this.moduleRepository.findById(data.module_id);
        if (!module) {
            throw new ModuleNotFoundError(data.module_id);
        }

        // Check for duplicate
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

    async updatePermission(permissionId: string, data: Partial<Permissions>): Promise<Permissions> {
        const existing = await this.permissionsRepository.findById(permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }

        return this.permissionsRepository.update(permissionId, data);
    }

    async deletePermission(permissionId: string): Promise<void> {
        const existing = await this.permissionsRepository.findById(permissionId);
        if (!existing) {
            throw new PermissionNotFoundError(permissionId);
        }

        return this.permissionsRepository.delete(permissionId);
    }

    async getProfileById(profileId: string): Promise<Profiles> {
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }
        return profile;
    }

    async getProfileByCode(code: string): Promise<Profiles> {
        const profile = await this.profilesRepository.findByCode(code);
        if (!profile) {
            throw new ProfileNotFoundError(code);
        }
        return profile;
    }

    async listAllProfiles(): Promise<Profiles[]> {
        return this.profilesRepository.findAll();
    }

    async createProfile(
        data: {
            name: string;
            code: string;
            description?: string;
            is_active?: boolean;
        },
        createdBy?: string
    ): Promise<Profiles> {
        // Check for duplicate code
        const existing = await this.profilesRepository.findByCode(data.code);
        if (existing) {
            throw new DuplicateAssignmentError(`profile code '${data.code}'`);
        }

        return this.profilesRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: createdBy ?? null
        });
    }

    async updateProfile(profileId: string, data: Partial<Profiles>): Promise<Profiles> {
        const existing = await this.profilesRepository.findById(profileId);
        if (!existing) {
            throw new ProfileNotFoundError(profileId);
        }

        // Check code uniqueness if changing code
        if (data.code && data.code !== existing.code) {
            const codeConflict = await this.profilesRepository.findByCode(data.code);
            if (codeConflict) {
                throw new DuplicateAssignmentError(`profile code '${data.code}'`);
            }
        }

        return this.profilesRepository.update(profileId, data);
    }

    async deleteProfile(profileId: string): Promise<void> {
        const existing = await this.profilesRepository.findById(profileId);
        if (!existing) {
            throw new ProfileNotFoundError(profileId);
        }

        return this.profilesRepository.delete(profileId);
    }

    async assignPermissionToProfile(
        profileId: string,
        permissionId: string,
        effect: PermissionEffect
    ): Promise<void> {
        // Verify profile exists
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        // Verify permission exists
        const permission = await this.permissionsRepository.findById(permissionId);
        if (!permission) {
            throw new PermissionNotFoundError(permissionId);
        }

        // Check if already assigned
        const existingAssignment = await this.profilePermissionsRepository.findAssignment(profileId, permissionId);
        if (existingAssignment) {
            // Update effect if different
            if (existingAssignment.effect !== effect) {
                await this.profilePermissionsRepository.updateEffect(profileId, permissionId, effect);
            }
            return;
        }

        await this.profilePermissionsRepository.assign(profileId, permissionId, effect);
    }

    async revokePermissionFromProfile(profileId: string, permissionId: string): Promise<void> {
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilePermissionsRepository.revoke(profileId, permissionId);
    }

    async assignProfileToRole(
        profileId: string,
        roleId: string,
        assignedBy?: string
    ): Promise<void> {
        // Verify profile exists
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        // Verify role exists
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        // Check if already assigned
        const hasProfile = await this.roleProfilesRepository.hasProfile(roleId, profileId);
        if (hasProfile) {
            return; // Idempotent - already assigned
        }

        await this.roleProfilesRepository.assign(roleId, profileId, assignedBy);
    }

    async revokeProfileFromRole(profileId: string, roleId: string): Promise<void> {
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

    async getProfilePermissions(profileId: string): Promise<Array<{
        permission: Permissions;
        effect: PermissionEffect;
    }>> {
        const profilePermissions = await this.profilePermissionsRepository.findPermissionsByProfile(profileId);

        const result: Array<{ permission: Permissions; effect: PermissionEffect }> = [];

        for (const pp of profilePermissions) {
            const permission = await this.permissionsRepository.findById(pp.permission_id);
            if (permission) {
                result.push({
                    permission,
                    effect: pp.effect
                });
            }
        }

        return result;
    }

    async getRoleProfiles(roleId: string): Promise<Profiles[]> {
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
