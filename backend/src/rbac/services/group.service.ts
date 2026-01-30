/**
 * UnifiedGroupService
 * 
 * Business logic for group management.
 * All mutating operations require RBAC enforcement.
 */

import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import { IEvaluationService } from './evaluation.service';
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
        private evaluationService: IEvaluationService
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

        return this.groupRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
    }

    async update(actingUserId: string, groupId: string, data: UpdateGroupRequestDto): Promise<Groups> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        if (data.name && data.name !== existing.name) {
            const conflict = await this.groupRepository.findByName(data.name);
            if (conflict) throw new DuplicateAssignmentError(`group name '${data.name}'`);
        }

        return this.groupRepository.update(groupId, data);
    }

    async delete(actingUserId: string, groupId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        await this.groupRepository.delete(groupId);
    }

    // -----------------------
    // Role operations
    // -----------------------
    async assignRole(actingUserId: string, groupId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists
        await this.groupRoleRepository.assignRole(groupId, roleId, actingUserId);
    }

    async removeRole(actingUserId: string, groupId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists
        await this.groupRoleRepository.removeRole(groupId, roleId);
    }

    async replaceRoles(actingUserId: string, groupId: string, roleIds: string[]): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');
        await this.getById(actingUserId, groupId); // validate group exists
        await this.groupRoleRepository.replaceRoles(groupId, roleIds, actingUserId);
    }

    async getRoles(actingUserId: string, groupId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        await this.getById(actingUserId, groupId); // validate group exists
        return this.groupRoleRepository.findRolesByGroup(groupId);
    }
}
