/**
 * UnifiedGroupService
 *
 * Business logic for group lifecycle: creation, updates, deletion,
 * and management of role/user assignments within groups.
 * All mutating operations are audit-logged.
 */
import { TransactionTask } from '../../utils/transaction.utils';
import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import { IAuditService } from './audit.service';
import {
    GroupNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { CreateGroupRequestDto, GroupResponseDto, UpdateGroupRequestDto } from '../dto/group.dto';
import { PaginationParams, PaginatedResult } from '../../utils/pagination.utils';
import { IUserGroupsRepository } from '../repositories/user_groups.repository';
import { assertRequiredString, assertOptionalString, assertCodeFormat, normalizeStringArray } from '../../utils/validators';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUnifiedGroupService {
    /** Retrieve a single group by ID with associated roles and users. */
    getById(t: TransactionTask, actingUserId: string, groupId: string): Promise<GroupResponseDto>;
    /** Create a new group and optionally assign roles and users to it. */
    create(t: TransactionTask, actingUserId: string, data: CreateGroupRequestDto, auditCtx?: AuditContext): Promise<Groups>;
    /** Delete (soft-delete) a group. */
    delete(t: TransactionTask, actingUserId: string, groupId: string, auditCtx?: AuditContext): Promise<void>;
    /** Update group attributes and optionally reassign roles and users. */
    update(t: TransactionTask, actingUserId: string, groupId: string, data: UpdateGroupRequestDto, auditCtx?: AuditContext): Promise<Groups>;
    /** List groups with optional filters and pagination. */
    listAll(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
}

export class UnifiedGroupService implements IUnifiedGroupService {
    constructor(
        private groupRepository: IGroupRepository,
        private groupRoleRepository: IGroupRoleRepository,
        private auditService: IAuditService,
        private userGroupsRepository: IUserGroupsRepository
    ) { }

    /**
     * Retrieve a single group with its associated roles, users, and audit-field names.
     * @throws GroupNotFoundError if the group does not exist.
     */
    async getById(t: TransactionTask, actingUserId: string, groupId: string): Promise<GroupResponseDto> {
        const group = await this.groupRepository.findByIdWithDetails(t, groupId);
        if (!group) throw new GroupNotFoundError(groupId);
        return group;
    }

    /** List groups with optional active/name/code filters and pagination. */
    async listAll(
        t: TransactionTask,
        actingUserId: string,
        filters?: { is_active?: boolean; name?: string; code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Groups>> {
        return this.groupRepository.findAllPaginated(t, filters, pagination);
    }

    /**
     * Create a new group with validated name, code, and optional description.
     * Assigns roles and users if provided.
     * @throws DuplicateAssignmentError if group code already exists.
     */
    async create(t: TransactionTask, actingUserId: string, data: CreateGroupRequestDto, auditCtx?: AuditContext): Promise<Groups> {
        assertRequiredString(data.name, 'Group name');
        assertRequiredString(data.code, 'Group code');
        assertCodeFormat(data.code, 'Group code');
        assertOptionalString(data.description, 'Group description');
        const existing = await this.groupRepository.findByCode(t, data.code);
        if (existing) {
            throw new DuplicateAssignmentError(`group code '${data.code}'`);
        }

        const group = await this.groupRepository.create(t, {
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });

        const roles = normalizeStringArray(data.role_ids, 'role_ids');
        if (roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(t, group.id, roles, actingUserId);
        }

        const users = normalizeStringArray(data.user_ids, 'user_ids');
        if (users.length > 0) {
            await this.userGroupsRepository.replaceUsers(t, group.id, users, actingUserId);
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'group',
            entity_id: group.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });

        return group;
    }

    /**
     * Update a group's attributes and optionally reassign its roles and users.
     * @throws GroupNotFoundError if the group does not exist.
     */
    async update(
        t: TransactionTask,
        actingUserId: string,
        groupId: string,
        data: UpdateGroupRequestDto,
        auditCtx?: AuditContext
    ): Promise<Groups> {
        if (data.name !== undefined) {
            assertRequiredString(data.name, 'Group name');
        }
        if (data.code !== undefined) {
            assertRequiredString(data.code, 'Group code');
            assertCodeFormat(data.code, 'Group code');
        }
        assertOptionalString(data.description, 'Group description');
        const existing = await this.groupRepository.findById(t, groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        const updated: Groups = {
            id: existing.id,
            version: data.version,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: (data.description ?? existing.description) as string | null,
            is_active: data.is_active ?? existing.is_active,
            created_by: existing.created_by as string | null,
            created_at: existing.created_at,
            updated_by: actingUserId
        };

        const result = await this.groupRepository.update(t, groupId, updated);

        const roles = normalizeStringArray(data.role_ids, 'role_ids');
        if (roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(t, groupId, roles, actingUserId);
        }

        const users = normalizeStringArray(data.user_ids, 'user_ids');
        if (users.length > 0) {
            await this.userGroupsRepository.replaceUsers(t, groupId, users, actingUserId);
        }

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            entity_type: 'group',
            module_code: MODULE_CODE,
            entity_id: groupId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...data } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return result;
    }

    /**
     * Soft-delete a group.
     * @throws GroupNotFoundError if the group does not exist.
     */
    async delete(t: TransactionTask, actingUserId: string, groupId: string, auditCtx?: AuditContext): Promise<void> {
        const existing = await this.groupRepository.findById(t, groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        await this.groupRepository.delete(t, groupId);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'group',
            module_code: MODULE_CODE,
            entity_id: groupId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { delete: true, actingUserId: actingUserId } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }
}
