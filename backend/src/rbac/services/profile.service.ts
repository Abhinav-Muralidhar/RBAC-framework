/**
 * UnifiedProfileService
 * 
 * Business logic for profile management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */
import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../utils/transaction.utils';
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
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IProfileService {
    getById(t: TransactionTask, actingUserId: string, profileId: string): Promise<ProfileResponseDto>
    listPaginated(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean, code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Profiles>>;
    create(t: TransactionTask, actingUserId: string, data: CreateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles>;
    update(t: TransactionTask, actingUserId: string, profileId: string, data: UpdateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles>;
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

    async getById(t: TransactionTask, actingUserId: string, profileId: string): Promise<ProfileResponseDto> {

        const profile = await this.profilesRepository.findByIdWithDetails(t, profileId);
        if (!profile) throw new ProfileNotFoundError(profileId);
        return profile;
    }

    async listPaginated(
        t: TransactionTask, actingUserId: string,
        filters?: { is_active?: boolean, code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Profiles>> {
        return this.profilesRepository.findAllPaginated(t, filters, pagination);
    }

    //create profile as well as do thing like update its premissions wiht default allow
    async create(t: TransactionTask, actingUserId: string, data: CreateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles> {
        const existing = await this.profilesRepository.findAllPaginated(t, { search: data.code as string });
        if (existing.data.length > 0) throw new DuplicateAssignmentError(`profile code '${data.code}'`);

        const profile = await this.profilesRepository.create(t, {
            name: data.name!,
            code: data.code!,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
        const perms = data.permission_ids ?? []

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
    //update the profile along wihtits premissions with default allow
    async update(t: TransactionTask, actingUserId: string, profileId: string, data: UpdateProfileRequestDto, auditCtx?: AuditContext): Promise<Profiles> {
        const existing = await this.profilesRepository.findById(t, profileId);
        if (!existing) throw new ProfileNotFoundError(profileId);

        if (data.code && data.code !== existing.code) {
            const conflict = await this.profilesRepository.findAllPaginated(t, { search: data.code });
            if (conflict.data.length > 0) throw new DuplicateAssignmentError(`profile code '${data.code}'`);
        }

        const prof: Profiles = {
            id: profileId,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_at: existing.created_at,
        }

        const updated = await this.profilesRepository.update(t, profileId, prof);
        const perms = data.permission_ids ?? []
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

    async delete(t: TransactionTask, actingUserId: string, profileId: string, auditCtx?: AuditContext): Promise<void> {
        const existing = await this.profilesRepository.findById(t, profileId);
        if (!existing) throw new ProfileNotFoundError(profileId);

        const prof: Profiles = {
            id: profileId,
            name: existing.name,
            code: existing.code,
            description: existing.description as string,
            is_active: false,
            created_at: existing.created_at,
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
