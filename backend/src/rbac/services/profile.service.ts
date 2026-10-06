/**
 * ProfileService
 *
 * Business logic for profile lifecycle: creation, updates, soft-deletion,
 * and management of permission assignments within profiles.
 * All mutating operations are audit-logged.
 */
import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../../utils/transaction.utils';
import { Profiles } from '../models/profiles.model';
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
import { CreateProfileRequestDto, ProfileResponseDto, UpdateProfileRequestDto } from '../dto/profile.dto';
import { PaginationParams, PaginatedResult } from '../../utils/pagination.utils';
import { assertRequiredString, assertOptionalString, assertCodeFormat, normalizeStringArray } from '../../utils/validators';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IProfileService {
    /** Retrieve a single profile by ID with its assigned permissions. */
    getById(t: TransactionTask, actingUserId: string, profileId: string): Promise<ProfileResponseDto>
    /** List profiles with optional active/code filters and pagination. */
    listPaginated(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean, code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Profiles>>;
    /** Create a new profile and optionally assign permissions to it. */
    create(t: TransactionTask, actingUserId: string, data: CreateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles>;
    /** Update a profile's attributes and optionally reassign permissions. */
    update(t: TransactionTask, actingUserId: string, profileId: string, data: UpdateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles>;
    /** Soft-delete a profile by setting is_active to false. */
    delete(t: TransactionTask, actingUserId: string, profileId: string, auditCtx?: AuditContext): Promise<void>;
}

export class ProfileService implements IProfileService {
    constructor(
        private profilesRepository: IProfilesRepository,
        private profilePermissionsRepository: IProfilePermissionsRepository,
        private permissionsRepository: IPermissionsRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    /**
     * Retrieve a single profile with its assigned permissions and audit-field names.
     * @throws ProfileNotFoundError if the profile does not exist.
     */
    async getById(t: TransactionTask, actingUserId: string, profileId: string): Promise<ProfileResponseDto> {

        const profile = await this.profilesRepository.findByIdWithDetails(t, profileId);
        if (!profile) throw new ProfileNotFoundError(profileId);
        return profile;
    }

    /** List profiles with optional active/code filters and pagination. */
    async listPaginated(
        t: TransactionTask, actingUserId: string,
        filters?: { is_active?: boolean, code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Profiles>> {
        return this.profilesRepository.findAllPaginated(t, filters, pagination);
    }

    /**
     * Create a new profile and optionally assign permissions to it (default effect: allow).
     * Validates name, code format, and checks for code uniqueness (case-insensitive).
     * @throws DuplicateAssignmentError if profile code already exists.
     * @throws PermissionNotFoundError if any permission ID is invalid.
     */
    async create(t: TransactionTask, actingUserId: string, data: CreateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles> {
        assertRequiredString(data.name, 'Profile name');
        assertRequiredString(data.code, 'Profile code');
        assertCodeFormat(data.code, 'Profile code');
        assertOptionalString(data.description, 'Profile description');
        const existing = await this.profilesRepository.findAllPaginated(t, { search: data.code });
        const codeConflict = existing.data.find(p => p.code.toLowerCase() === (data.code as string).toLowerCase());
        if (codeConflict) throw new DuplicateAssignmentError(`profile code '${data.code}'`);

        const profile = await this.profilesRepository.create(t, {
            name: data.name!,
            code: data.code!,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
        const perms = normalizeStringArray(data.permission_ids, 'permission_ids');

        if (perms.length > 0) {
            const permissions = await this.permissionsRepository.findByIds(t, perms as string[]);

            if (permissions.length !== perms.length) {
                const foundIds = new Set(permissions.map(p => p.id));
                const missing = perms.filter(id => !foundIds.has(id));
                throw new PermissionNotFoundError(missing.join(', '));
            }
            await this.profilePermissionsRepository.replacePermissions(t, profile.id, permissions.map(p => p.id));
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'profile',
            entity_id: profile.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });

        return profile;
    }
    /**
     * Update a profile's attributes and optionally reassign its permissions.
     * Validates input, checks for code uniqueness on code change.
     * @throws ProfileNotFoundError if the profile does not exist.
     * @throws DuplicateAssignmentError if the new code conflicts with another profile.
     * @throws PermissionNotFoundError if any permission ID is invalid.
     */
    async update(t: TransactionTask, actingUserId: string, profileId: string, data: UpdateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles> {
        if (data.name !== undefined) {
            assertRequiredString(data.name, 'Profile name');
        }
        if (data.code !== undefined) {
            assertRequiredString(data.code, 'Profile code');
            assertCodeFormat(data.code, 'Profile code');
        }
        assertOptionalString(data.description, 'Profile description');
        const existing = await this.profilesRepository.findById(t, profileId);
        if (!existing) throw new ProfileNotFoundError(profileId);

        if (data.code && data.code !== existing.code) {
            const conflict = await this.profilesRepository.findAllPaginated(t, { search: data.code });
            const duplicate = conflict.data.some(profile => profile.id !== profileId && profile.code.toLowerCase() === data.code!.toLowerCase());
            if (duplicate) throw new DuplicateAssignmentError(`profile code '${data.code}'`);
        }

        const prof: Profiles = {
            id: profileId,
            version: data.version,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_at: existing.created_at,
            updated_by: actingUserId
        }

        const updated = await this.profilesRepository.update(t, profileId, prof);
        const perms = normalizeStringArray(data.permission_ids, 'permission_ids');
        if (perms.length > 0) {
            const permissions = await this.permissionsRepository.findByIds(t, perms as string[]);
            if (permissions.length !== perms.length) {
                const foundIds = new Set(permissions.map(p => p.id));
                const missing = perms.filter(id => !foundIds.has(id));
                throw new PermissionNotFoundError(missing.join(', '));
            }
            await this.profilePermissionsRepository.replacePermissions(t, profileId, permissions.map(p => p.id));
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            module_code: MODULE_CODE,
            action: 'update',
            entity_type: 'profile',
            entity_id: profileId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...updated } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });

        return updated;
    }

    /**
     * Soft-delete a profile by setting is_active to false.
     * @throws ProfileNotFoundError if the profile does not exist.
     */
    async delete(t: TransactionTask, actingUserId: string, profileId: string, auditCtx?: AuditContext): Promise<void> {
        const existing = await this.profilesRepository.findById(t, profileId);
        if (!existing) throw new ProfileNotFoundError(profileId);

        const prof: Profiles = {
            id: profileId,
            version: existing.version,
            name: existing.name,
            code: existing.code,
            description: existing.description as string,
            is_active: false,
            created_at: existing.created_at,
            updated_by: actingUserId
        }

        await this.profilesRepository.update(t, profileId, prof);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'profile',
            entity_id: profileId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { deleted: true, user_id: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
    }
}
