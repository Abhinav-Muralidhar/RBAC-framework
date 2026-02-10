/**
 * UnifiedGroupService
 * 
 * Business logic for group management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */
import { TransactionTask } from '../utils/transaction.utils';
import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import { IAuditService } from './audit.service';
import {
    GroupNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { CreateGroupRequestDto, GroupResponseDto } from '../dto/group.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { IUserGroupsRepository } from '../repositories/user_groups.repository';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUnifiedGroupService {
    getById(t: TransactionTask, actingUserId: string, groupId: string): Promise<GroupResponseDto>;
    create(t: TransactionTask, actingUserId: string, data: CreateGroupRequestDto): Promise<Groups>;
    delete(t: TransactionTask, actingUserId: string, groupId: string): Promise<void>;
    update(t: TransactionTask, actingUserId: string, groupId: string, data: CreateGroupRequestDto): Promise<Groups>;
    listAll(t: TransactionTask, actingUserId: string, filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
}

export class UnifiedGroupService implements IUnifiedGroupService {
    constructor(
        private groupRepository: IGroupRepository,
        private groupRoleRepository: IGroupRoleRepository,
        private auditService: IAuditService,
        private userGroupsRepository: IUserGroupsRepository
    ) { }

    async getById(t: TransactionTask, actingUserId: string, groupId: string): Promise<GroupResponseDto> {
        const group = await this.groupRepository.findByIdWithDetails(t, groupId);
        if (!group) throw new GroupNotFoundError(groupId);
        return group;
    }

    async listAll(
        t: TransactionTask,
        actingUserId: string,
        filters?: { is_active?: boolean; name?: string; code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Groups>> {
        return this.groupRepository.findAllPaginated(t, filters, pagination);
    }

    async create(t: TransactionTask, actingUserId: string, data: CreateGroupRequestDto): Promise<Groups> {
        if (!data.name) throw new Error('Group name is required');
        if (!data.code) throw new Error('Group code is required');

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

        const roles: string[] = data.role_ids ?? [];
        if (roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(t, group.id, roles, actingUserId);
        }

        const users: string[] = data.user_ids ?? [];
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
            status: 'success'
        });

        return group;
    }

    async update(
        t: TransactionTask,
        actingUserId: string,
        groupId: string,
        data: CreateGroupRequestDto
    ): Promise<Groups> {
        const existing = await this.groupRepository.findById(t, groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        const updated: Groups = {
            id: existing.id,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: (data.description ?? existing.description) as string | null,
            is_active: data.is_active ?? existing.is_active,
            created_by: existing.created_by as string | null,
            created_at: existing.created_at
        };

        const result = await this.groupRepository.update(t, groupId, updated);

        const roles: string[] = data.role_ids ?? [];
        if (roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(t, groupId, roles, actingUserId);
        }

        const users: string[] = data.user_ids ?? [];
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
            status: 'success'
        })

        return result;
    }

    async delete(t: TransactionTask, actingUserId: string, groupId: string): Promise<void> {
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
            new_values: { is_deleted: true },
            status: 'success'
        })
    }
}
