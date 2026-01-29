/**
 * GroupService
 * 
 * Service layer for Group management.
 * OWNS: Group lifecycle, user-group memberships
 * MUST NOT: Evaluate permissions, manage roles directly, manage sharing rules
 */

import { Groups } from '../models/groups.model';
import { IGroupRepository } from '../repositories/groups.repository';
import { IUserGroupsRepository } from '../repositories/user_groups.repository';
import {
    GroupNotFoundError,
    DuplicateAssignmentError,
    RBACInternalError
} from '../errors/rbac.errors';

export interface IGroupService {
    /**
     * Get group by ID
     * @throws GroupNotFoundError
     */
    getById(groupId: string): Promise<Groups>;

    /**
     * Get group by name
     * @throws GroupNotFoundError
     */
    getByName(name: string): Promise<Groups>;

    /**
     * List all groups in organization
     */
    listAll(): Promise<Groups[]>;

    /**
     * List all active groups in organization
     */
    listActive(): Promise<Groups[]>;

    /**
     * List all inactive groups in organization
     */
    listInactive(): Promise<Groups[]>;

    /**
     * Create new group
     * @throws DuplicateAssignmentError if name exists
     */
    create(
        data: {
            name: string;
            description?: string;
            is_active?: boolean;
        },
        actingUserId: string
    ): Promise<Groups>;

    /**
     * Update group
     * @throws GroupNotFoundError
     */
    update(
        groupId: string,
        data: Partial<Groups>,
        actingUserId: string
    ): Promise<Groups>;

    /**
     * Delete group
     * @throws GroupNotFoundError
     */
    delete(
        groupId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Add user to group
     * @throws GroupNotFoundError
     * @throws DuplicateAssignmentError
     */
    addMember(
        groupId: string,
        userId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Remove user from group
     * @throws GroupNotFoundError
     */
    removeMember(
        groupId: string,
        userId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Get all users in a group
     */
    getMembers(groupId: string): Promise<string[]>;

    /**
     * Get all groups a user belongs to
     */
    getUserGroups(userId: string): Promise<Groups[]>;
}

/**
 * GroupService implementation
 */
export class GroupService implements IGroupService {
    constructor(
        private groupRepository: IGroupRepository,
        private userGroupsRepository: IUserGroupsRepository
    ) { }

    async getById(groupId: string): Promise<Groups> {
        const group = await this.groupRepository.findById(groupId);
        if (!group) {
            throw new GroupNotFoundError(groupId);
        }
        return group;
    }

    async getByName(name: string): Promise<Groups> {
        const group = await this.groupRepository.findByName(name);
        if (!group) {
            throw new GroupNotFoundError(name);
        }
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

    async create(
        data: {
            name: string;
            description?: string;
            is_active?: boolean;
        },
        actingUserId: string
    ): Promise<Groups> {
        // Check for duplicate name
        const existing = await this.groupRepository.findByName(data.name);
        if (existing) {
            throw new DuplicateAssignmentError(`group name '${data.name}'`);
        }

        return this.groupRepository.create({
            name: data.name,
            description: data.description ?? null,
            is_active: data.is_active ?? true,
            created_by: actingUserId
        });
    }

    async update(
        groupId: string,
        data: Partial<Groups>,
        _actingUserId: string
    ): Promise<Groups> {
        // Verify group exists
        const existing = await this.groupRepository.findById(groupId);
        if (!existing) {
            throw new GroupNotFoundError(groupId);
        }

        // Check name uniqueness if changing name
        if (data.name && data.name !== existing.name) {
            const nameConflict = await this.groupRepository.findByName(data.name);
            if (nameConflict) {
                throw new DuplicateAssignmentError(`group name '${data.name}'`);
            }
        }

        return this.groupRepository.update(groupId, data);
    }

    async delete(groupId: string, _actingUserId: string): Promise<void> {
        const existing = await this.groupRepository.findById(groupId);
        if (!existing) {
            throw new GroupNotFoundError(groupId);
        }

        return this.groupRepository.delete(groupId);
    }

    async addMember(
        groupId: string,
        userId: string,
        actingUserId: string
    ): Promise<void> {
        // Verify group exists
        const group = await this.groupRepository.findById(groupId);
        if (!group) {
            throw new GroupNotFoundError(groupId);
        }

        await this.userGroupsRepository.addMember(userId, groupId, actingUserId);
    }

    async removeMember(
        groupId: string,
        userId: string,
        _actingUserId: string
    ): Promise<void> {
        // Verify group exists
        const group = await this.groupRepository.findById(groupId);
        if (!group) {
            throw new GroupNotFoundError(groupId);
        }

        await this.userGroupsRepository.removeMember(userId, groupId);
    }

    async getMembers(groupId: string): Promise<string[]> {
        const members = await this.userGroupsRepository.findUsersByGroup(groupId);
        return members.map(m => m.user_id);
    }

    async getUserGroups(userId: string): Promise<Groups[]> {
        const memberships = await this.userGroupsRepository.findGroupsByUser(userId);
        const groups: Groups[] = [];

        for (const membership of memberships) {
            const group = await this.groupRepository.findById(membership.group_id);
            if (group) {
                groups.push(group);
            }
        }

        return groups;
    }
}
