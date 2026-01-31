/**
 * UnifiedGroupService
 * 
 * Business logic for group management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import {
    GroupNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { GroupListFilterDto, CreateGroupRequestDto, UpdateGroupRequestDto } from '../dto/group.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUnifiedGroupService {
    // Group operations
    getById(actingUserId: string, groupId: string): Promise<Groups>;
    getByName(actingUserId: string, name: string): Promise<Groups>;
    listAll(actingUserId: string): Promise<Groups[]>;
    listPaginated(actingUserId: string, filters?: GroupListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
    listActive(actingUserId: string): Promise<Groups[]>;
    listInactive(actingUserId: string): Promise<Groups[]>;
    create(actingUserId: string, data: CreateGroupRequestDto): Promise<Groups>;
    update(actingUserId: string, groupId: string, data: UpdateGroupRequestDto): Promise<Groups>;
    delete(actingUserId: string, groupId: string): Promise<void>;

    // Role operations
    assignRole(actingUserId: string, groupId: string, roleId: string): Promise<void>;
    removeRole(actingUserId: string, groupId: string, roleId: string): Promise<void>;
    replaceRoles(actingUserId: string, groupId: string, roleIds: string[]): Promise<void>;
    getRoles(actingUserId: string, groupId: string): Promise<string[]>;
}

export class UnifiedGroupService implements IUnifiedGroupService {
    constructor(
        private groupRepository: IGroupRepository,
        private groupRoleRepository: IGroupRoleRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    // -----------------------
    // Group operations
    // -----------------------
    async getById(actingUserId: string, groupId: string): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const group = await this.groupRepository.findById(groupId);
        if (!group) throw new GroupNotFoundError(groupId);
        return group;
    }

    async getByName(actingUserId: string, name: string): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        const group = await this.groupRepository.findByName(name);
        if (!group) throw new GroupNotFoundError(name);
        return group;
    }

    async listAll(actingUserId: string): Promise<Groups[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.groupRepository.findAll();
    }

    async listPaginated(
        actingUserId: string,
        filters?: GroupListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Groups>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.groupRepository.findAllPaginated(filters, pagination);
    }

    async listActive(actingUserId: string): Promise<Groups[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.groupRepository.findActive();
    }

    async listInactive(actingUserId: string): Promise<Groups[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.groupRepository.findInactive();
    }

    async create(actingUserId: string, data: CreateGroupRequestDto): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        if (!data.name) throw new Error('Group name is required');
        const existing = await this.groupRepository.findByName(data.name);
        if (existing) throw new DuplicateAssignmentError(`group name '${data.name}'`);

        const group = await this.groupRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });

        // AUDIT: Log group creation (fire-and-forget)
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

    async update(actingUserId: string, groupId: string, data: UpdateGroupRequestDto): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        if (data.name && data.name !== existing.name) {
            const conflict = await this.groupRepository.findByName(data.name);
            if (conflict) throw new DuplicateAssignmentError(`group name '${data.name}'`);
        }

        const updatedGroup = await this.groupRepository.update(groupId, data);

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

    // -----------------------
    // Role operations
    // -----------------------
    async assignRole(actingUserId: string, groupId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists
        await this.groupRoleRepository.assignRole(groupId, roleId, actingUserId);

        // AUDIT: Log group-role assignment (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'group_role',
            entity_id: `${groupId}:${roleId}`,
            old_values: null,
            new_values: { group_id: groupId, role_id: roleId },
            status: 'success'
        }).catch(console.error);
    }

    async removeRole(actingUserId: string, groupId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists
        await this.groupRoleRepository.removeRole(groupId, roleId);

        // AUDIT: Log group-role removal (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'group_role',
            entity_id: `${groupId}:${roleId}`,
            old_values: { group_id: groupId, role_id: roleId },
            status: 'success'
        }).catch(console.error);
    }

    async replaceRoles(actingUserId: string, groupId: string, roleIds: string[]): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists

        // Get old roles for audit
        const oldRoleIds = await this.groupRoleRepository.findRolesByGroup(groupId);

        await this.groupRoleRepository.replaceRoles(groupId, roleIds, actingUserId);

        // AUDIT: Log group roles replacement (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'group_roles',
            entity_id: groupId,
            old_values: { role_ids: oldRoleIds },
            new_values: { role_ids: roleIds },
            status: 'success'
        }).catch(console.error);
    }

    async getRoles(actingUserId: string, groupId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        await this.getById(actingUserId, groupId); // validate group exists
        return this.groupRoleRepository.findRolesByGroup(groupId);
    }
}
