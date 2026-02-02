/**
 * UnifiedGroupService
 * 
 * Business logic for group management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */
import { IDatabase } from 'pg-promise';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';
import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import {
    GroupNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { GroupResponseDto } from '../dto/group.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { IUserGroupsRepository } from '../repositories/user_groups.repository';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUnifiedGroupService {
    // Group operations
    getById(actingUserId: string, groupId: string): Promise<GroupResponseDto>;
    create(actingUserId: string, data: GroupResponseDto): Promise<Groups>;
    delete(actingUserId: string, groupId: string): Promise<void>
    update(actingUserId: string, groupId: string, data: GroupResponseDto): Promise<Groups>;
    listAll(actingUserId: string, filters?: { is_active?: boolean, name?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
}

export class UnifiedGroupService implements IUnifiedGroupService {
    constructor(
        private db: IDatabase<unknown>,
        private groupRepository: IGroupRepository,
        private groupRoleRepository: IGroupRoleRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
        private userRepository: IUserGroupsRepository
    ) { }

    async getById(actingUserId: string, groupId: string): Promise<GroupResponseDto> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const group = await this.groupRepository.findByIdWithDetails(groupId);
        if (!group) throw new GroupNotFoundError(groupId);
        return group;
    }

    async listAll(
        actingUserId: string,
        filters?: { is_active?: boolean, name?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Groups>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.groupRepository.findAllPaginated(filters, pagination);
    }

    async create(actingUserId: string, data: GroupResponseDto): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        if (!data.name) throw new Error('Group name is required');
        if (!data.code) throw new Error('Group code is required');
        const existing = await this.groupRepository.findByName(data.name);
        if (existing) throw new DuplicateAssignmentError(`group name '${data.name}'`);
        const group = await this.groupRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
        const roles = data.roles.map((role) => role.id);
        if (roles && roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(group.id, roles, actingUserId);
        }

        const users = data.users.map((user) => user.id);
        if (users && users.length > 0) {
            await this.userRepository.replaceUsers(group.id, users, actingUserId);
        }
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'group',
            entity_id: group.id,
            old_values: null,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);
        return group;
    }

    async update(actingUserId: string, groupId: string, data: GroupResponseDto): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);
        const oldG: Groups = {
            id: existing.id,
            name: data.name ?? existing.name,
            code: data.code ?? existing.code,
            description: (data.description ?? existing.description) as string | null,
            is_active: data.is_active ?? existing.is_active,
            created_by: existing.created_by as string | null,
            created_at: existing.created_at,
        }

        const updatedGroup = await this.groupRepository.update(groupId, oldG);
        const roles = data.roles.map((role) => role.id);
        if (roles && roles.length > 0) {
            await this.groupRoleRepository.replaceRoles(groupId, roles, actingUserId);
        }

        const users = data.users.map((user) => user.id);
        if (users && users.length > 0) {
            await this.userRepository.replaceUsers(groupId, users, actingUserId);
        }

        // AUDIT: Log group update (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'group',
            entity_id: groupId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { ...data } as Record<string, unknown>,
            status: 'success'
        }).catch(console.error);

        return updatedGroup;
    }

    async delete(actingUserId: string, groupId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        await this.groupRepository.delete(groupId);

        // AUDIT: Log group deletion (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'group',
            entity_id: groupId,
            old_values: { ...existing } as Record<string, unknown>,
            new_values: { is_deleted: true },
            status: 'success'
        }).catch(console.error);
    }
}
