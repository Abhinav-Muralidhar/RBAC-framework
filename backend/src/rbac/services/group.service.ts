import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IGroupRoleRepository } from '../repositories/group_roles.repository';
import {
    GroupNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';

export interface IUnifiedGroupService {
    // Group operations
    getById(groupId: string): Promise<Groups>;
    getByName(name: string): Promise<Groups>;
    listAll(): Promise<Groups[]>;
    listActive(): Promise<Groups[]>;
    listInactive(): Promise<Groups[]>;
    create(data: Partial<Groups>, actingUserId: string): Promise<Groups>;
    update(groupId: string, data: Partial<Groups>, actingUserId: string): Promise<Groups>;
    delete(groupId: string, actingUserId: string): Promise<void>;

    // Role operations
    assignRole(groupId: string, roleId: string, assignedBy?: string | null): Promise<void>;
    removeRole(groupId: string, roleId: string): Promise<void>;
    replaceRoles(groupId: string, roleIds: string[], assignedBy?: string | null): Promise<void>;
    getRoles(groupId: string): Promise<string[]>;
}

export class UnifiedGroupService implements IUnifiedGroupService {
    constructor(
        private groupRepository: IGroupRepository,
        private groupRoleRepository: IGroupRoleRepository
    ) {}

    // -----------------------
    // Group operations
    // -----------------------
    async getById(groupId: string): Promise<Groups> {
        const group = await this.groupRepository.findById(groupId);
        if (!group) throw new GroupNotFoundError(groupId);
        return group;
    }

    async getByName(name: string): Promise<Groups> {
        const group = await this.groupRepository.findByName(name);
        if (!group) throw new GroupNotFoundError(name);
        return group;
    }

    async listAll(): Promise<Groups[]> {
        return this.groupRepository.findAll();
    }

    async listActive(): Promise<Groups[]> {
        return this.groupRepository.findActive();
    }

    async listInactive(): Promise<Groups[]> {
        return this.groupRepository.findInactive();
    }

    async create(data: Partial<Groups>, actingUserId: string): Promise<Groups> {
        if (!data.name) throw new Error('Group name is required');
        const existing = await this.groupRepository.findByName(data.name);
        if (existing) throw new DuplicateAssignmentError(`group name '${data.name}'`);

        return this.groupRepository.create({
            name: data.name,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
    }

    async update(groupId: string, data: Partial<Groups>, _actingUserId: string): Promise<Groups> {
        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        if (data.name && data.name !== existing.name) {
            const conflict = await this.groupRepository.findByName(data.name);
            if (conflict) throw new DuplicateAssignmentError(`group name '${data.name}'`);
        }

        return this.groupRepository.update(groupId, data);
    }

    async delete(groupId: string, _actingUserId: string): Promise<void> {
        const existing = await this.groupRepository.findById(groupId);
        if (!existing) throw new GroupNotFoundError(groupId);

        await this.groupRepository.delete(groupId);
    }

    // -----------------------
    // Role operations
    // -----------------------
    async assignRole(groupId: string, roleId: string, assignedBy?: string | null): Promise<void> {
        await this.getById(groupId); // validate group exists
        await this.groupRoleRepository.assignRole(groupId, roleId, assignedBy);
    }

    async removeRole(groupId: string, roleId: string): Promise<void> {
        await this.getById(groupId); // validate group exists
        await this.groupRoleRepository.removeRole(groupId, roleId);
    }

    async replaceRoles(groupId: string, roleIds: string[], assignedBy?: string | null): Promise<void> {
        await this.getById(groupId); // validate group exists
        await this.groupRoleRepository.replaceRoles(groupId, roleIds, assignedBy);
    }

    async getRoles(groupId: string): Promise<string[]> {
        await this.getById(groupId); // validate group exists
        return this.groupRoleRepository.findRolesByGroup(groupId);
    }
}
