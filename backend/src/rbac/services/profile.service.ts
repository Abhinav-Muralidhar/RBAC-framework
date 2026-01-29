/**
 * ProfileService
 * 
 * Service layer for Profile management.
 * OWNS: Profile lifecycle, profile-permission assignments, profile-role assignments
 * MUST NOT: Evaluate permissions, manage users directly, manage modules
 */

import { Profiles } from '../models/profiles.model';
import { Permissions } from '../models/permissions.model';
import { PermissionEffect } from '../models/profile_permissions.model';
import { IProfilesRepository } from '../repositories/profiles.repository';
import { IProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { IPermissionsRepository } from '../repositories/permissions.repository';
import {
    ProfileNotFoundError,
    PermissionNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';

// Response DTO type definitions
export interface ProfilePermissionFlagDto {
    permissionId: string;
    allowed: boolean;
}

export interface ProfileResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | undefined;
    is_active: boolean;
    permissions: ProfilePermissionFlagDto[];
}

export interface IProfileService {
    /**
     * Get profile by ID
     * @throws ProfileNotFoundError
     */
    getById(profileId: string): Promise<Profiles>;

    /**
     * Get profile by code
     * @throws ProfileNotFoundError
     */
    getByCode(code: string): Promise<Profiles>;

    /**
     * List all profiles
     */
    listAll(): Promise<Profiles[]>;

    /**
     * List all active profiles
     */
    listActive(): Promise<Profiles[]>;

    /**
     * Create new profile
     * @throws DuplicateAssignmentError if code exists
     */
    create(
        data: {
            name: string;
            code: string;
            description: string | undefined;
            is_active: boolean | undefined;
        },
        actingUserId: string
    ): Promise<Profiles>;

    /**
     * Update profile
     * @throws ProfileNotFoundError
     */
    update(
        profileId: string,
        data: Partial<Profiles>,
        actingUserId: string
    ): Promise<Profiles>;

    /**
     * Delete profile
     * @throws ProfileNotFoundError
     */
    delete(
        profileId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Assign permission to profile with effect
     * @throws ProfileNotFoundError
     * @throws PermissionNotFoundError
     * @throws DuplicateAssignmentError
     */
    assignPermission(
        profileId: string,
        permissionId: string,
        effect: PermissionEffect,
        actingUserId: string
    ): Promise<void>;

    /**
     * Revoke permission from profile
     * @throws ProfileNotFoundError
     * @throws PermissionNotFoundError
     */
    revokePermission(
        profileId: string,
        permissionId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Get all permissions for a profile
     */
    getPermissions(profileId: string): Promise<Array<{
        permission: Permissions;
        effect: PermissionEffect;
    }>>;

    /**
     * Get profile with all permissions (allowed true/false) for frontend
     */
    getProfileWithPermissions(profileId: string): Promise<ProfileResponseDto>;

    /**
     * Create profile with permissions in one transaction
     */
    createProfile(
        data: {
            name: string;
            description?: string;
            permission_ids: string[];
        },
        actingUserId: string
    ): Promise<{ id: string }>;

    /**
     * Replace all permissions for a profile (authoritative set replacement)
     */
    updateProfilePermissions(
        profileId: string,
        permissionIds: string[],
        actingUserId: string
    ): Promise<void>;
}

/**
 * ProfileService implementation
 */
export class ProfileService implements IProfileService {
    constructor(
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private permissionsRepository: IPermissionsRepository
    ) { }

    async getById(profileId: string): Promise<Profiles> {
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }
        return profile;
    }

    async getByCode(code: string): Promise<Profiles> {
        const profile = await this.profilesRepository.findByCode(code);
        if (!profile) {
            throw new ProfileNotFoundError(code);
        }
        return profile;
    }

    async listAll(): Promise<Profiles[]> {
        return this.profilesRepository.findAll();
    }

    async listActive(): Promise<Profiles[]> {
        return this.profilesRepository.findActive();
    }

    async create(
        data: {
            name: string;
            code: string;
            description: string | undefined;
            is_active: boolean | undefined;
        },
        actingUserId: string
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
            created_by: actingUserId
        });
    }

    async update(
        profileId: string,
        data: Partial<Profiles>,
        _actingUserId: string
    ): Promise<Profiles> {
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

    async delete(profileId: string, _actingUserId: string): Promise<void> {
        const existing = await this.profilesRepository.findById(profileId);
        if (!existing) {
            throw new ProfileNotFoundError(profileId);
        }

        return this.profilesRepository.delete(profileId);
    }

    async assignPermission(
        profileId: string,
        permissionId: string,
        effect: PermissionEffect,
        _actingUserId: string
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

        // Check if assignment already exists
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

    async revokePermission(
        profileId: string,
        permissionId: string,
        _actingUserId: string
    ): Promise<void> {
        // Verify profile exists
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilePermissionsRepository.revoke(profileId, permissionId);
    }

    async getPermissions(profileId: string): Promise<Array<{
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

    async getProfileWithPermissions(profileId: string): Promise<ProfileResponseDto> {
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        const profilePermissions = await this.profilePermissionsRepository.findPermissionsByProfile(profileId);

        const permissions: ProfilePermissionFlagDto[] = profilePermissions.map(pp => ({
            permissionId: pp.permission_id,
            allowed: pp.effect === 'allow'
        }));

        return {
            id: profile.id,
            name: profile.name,
            code: profile.code,
            description: profile.description ?? undefined,
            is_active: profile.is_active,
            permissions
        };
    }

    async createProfile(
        data: {
            name: string;
            description?: string;
            permission_ids: string[];
        },
        actingUserId: string
    ): Promise<{ id: string }> {
        // Generate a code from the name
        const code = data.name.toLowerCase().replace(/\s+/g, '_');

        const profile = await this.create({
            name: data.name,
            code,
            description: data.description,
            is_active: true
        }, actingUserId);

        // Assign permissions
        if (data.permission_ids.length > 0) {
            await this.profilePermissionsRepository.batchAssign(profile.id, data.permission_ids);
        }

        return { id: profile.id };
    }

    async updateProfilePermissions(
        profileId: string,
        permissionIds: string[],
        _actingUserId: string
    ): Promise<void> {
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilePermissionsRepository.replacePermissions(profileId, permissionIds);
    }
}
