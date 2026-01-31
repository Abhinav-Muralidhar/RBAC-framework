/**
 * ProfileService
 * 
 * Service layer for Profile management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { Profiles } from '../models/profiles.model';
import { Permissions } from '../models/permissions.model';
import { PermissionEffect } from '../models/profile_permissions.model';
import { IProfilesRepository } from '../repositories/profiles.repository';
import { IProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { IPermissionsRepository } from '../repositories/permissions.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import {
    ProfileNotFoundError,
    PermissionNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { ProfileListFilterDto, CreateProfileRequestDto, UpdateProfileRequestDto } from '../dto/profile.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

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
    getById(actingUserId: string, profileId: string): Promise<Profiles>;
    getByCode(actingUserId: string, code: string): Promise<Profiles>;
    listAll(actingUserId: string): Promise<Profiles[]>;
    listPaginated(actingUserId: string, filters?: ProfileListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Profiles>>;
    listActive(actingUserId: string): Promise<Profiles[]>;
    create(actingUserId: string, data: CreateProfileRequestDto): Promise<Profiles>;
    update(actingUserId: string, profileId: string, data: UpdateProfileRequestDto): Promise<Profiles>;
    delete(actingUserId: string, profileId: string): Promise<void>;
    assignPermission(actingUserId: string, profileId: string, permissionId: string, effect: PermissionEffect): Promise<void>;
    revokePermission(actingUserId: string, profileId: string, permissionId: string): Promise<void>;
    getPermissions(actingUserId: string, profileId: string): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>>;
    getProfileWithPermissions(actingUserId: string, profileId: string): Promise<ProfileResponseDto>;
    createProfile(actingUserId: string, data: { name: string; description?: string; permission_ids: string[] }): Promise<{ id: string }>;
    updateProfilePermissions(actingUserId: string, profileId: string, permissionIds: string[]): Promise<void>;
}

export class ProfileService implements IProfileService {
    constructor(
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private permissionsRepository: IPermissionsRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    async getById(actingUserId: string, profileId: string): Promise<Profiles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }
        return profile;
    }

    async getByCode(actingUserId: string, code: string): Promise<Profiles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const profile = await this.profilesRepository.findByCode(code);
        if (!profile) {
            throw new ProfileNotFoundError(code);
        }
        return profile;
    }

    async listAll(actingUserId: string): Promise<Profiles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.profilesRepository.findAll();
    }

    async listPaginated(
        actingUserId: string,
        filters?: ProfileListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Profiles>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.profilesRepository.findAllPaginated(filters, pagination);
    }

    async listActive(actingUserId: string): Promise<Profiles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.profilesRepository.findActive();
    }

    async create(actingUserId: string, data: CreateProfileRequestDto): Promise<Profiles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        const existing = await this.profilesRepository.findByCode(data.code);
        if (existing) {
            throw new DuplicateAssignmentError(`profile code '${data.code}'`);
        }

        const profile = await this.profilesRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });

        // AUDIT: Log profile creation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'profile',
            entity_id: profile.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);

        return profile;
    }

    async update(actingUserId: string, profileId: string, data: UpdateProfileRequestDto): Promise<Profiles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

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

        const updatedProfile = await this.profilesRepository.update(profileId, data);

        // AUDIT: Log profile update (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'profile',
            entity_id: profileId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);

        return updatedProfile;
    }

    async delete(actingUserId: string, profileId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.profilesRepository.findById(profileId);
        if (!existing) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilesRepository.delete(profileId);

        // AUDIT: Log profile deletion (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'profile',
            entity_id: profileId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { is_deleted: true },
            status: 'success'
        }).catch(console.error);
    }

    async assignPermission(
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
                // AUDIT: Log permission effect update
                this.auditService.log({
                    user_id: actingUserId,
                    action: 'update',
                    entity_type: 'profile_permission',
                    entity_id: `${profileId}:${permissionId}`,
                    old_values: { effect: existingAssignment.effect },
                    new_values: { effect },
                    status: 'success'
                }).catch(console.error);
            }
            return;
        }

        await this.profilePermissionsRepository.assign(profileId, permissionId, effect);

        // AUDIT: Log permission assignment (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'profile_permission',
            entity_id: `${profileId}:${permissionId}`,
            old_values: null,
            new_values: { profile_id: profileId, permission_id: permissionId, effect },
            status: 'success'
        }).catch(console.error);
    }

    async revokePermission(actingUserId: string, profileId: string, permissionId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        await this.profilePermissionsRepository.revoke(profileId, permissionId);

        // AUDIT: Log permission revocation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'profile_permission',
            entity_id: `${profileId}:${permissionId}`,
            old_values: { profile_id: profileId, permission_id: permissionId },
            status: 'success'
        }).catch(console.error);
    }

    async getPermissions(actingUserId: string, profileId: string): Promise<Array<{ permission: Permissions; effect: PermissionEffect }>> {
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

    async getProfileWithPermissions(actingUserId: string, profileId: string): Promise<ProfileResponseDto> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

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
        actingUserId: string,
        data: { name: string; description?: string; permission_ids: string[] }
    ): Promise<{ id: string }> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        const code = data.name.toLowerCase().replace(/\s+/g, '_');

        const profile = await this.profilesRepository.create({
            name: data.name,
            code,
            description: data.description ?? null,
            is_active: true,
            created_by: actingUserId
        });

        if (data.permission_ids.length > 0) {
            await this.profilePermissionsRepository.batchAssign(profile.id, data.permission_ids);
        }

        // AUDIT: Log profile creation with permissions (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'profile',
            entity_id: profile.id,
            old_values: null,
            new_values: { ...data, code },
            status: 'success'
        }).catch(console.error);

        return { id: profile.id };
    }

    async updateProfilePermissions(actingUserId: string, profileId: string, permissionIds: string[]): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const profile = await this.profilesRepository.findById(profileId);
        if (!profile) {
            throw new ProfileNotFoundError(profileId);
        }

        // Get old permissions for audit
        const oldPerms = await this.profilePermissionsRepository.findPermissionsByProfile(profileId);
        const oldPermissionIds = oldPerms.map(p => p.permission_id);

        await this.profilePermissionsRepository.replacePermissions(profileId, permissionIds);

        // AUDIT: Log profile permissions update (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'profile_permissions',
            entity_id: profileId,
            old_values: { permission_ids: oldPermissionIds },
            new_values: { permission_ids: permissionIds },
            status: 'success'
        }).catch(console.error);
    }
}
