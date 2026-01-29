/**
 * RoleService
 * 
 * Business logic for role management.
 * NO permission evaluation logic here.
 */

import { Roles } from '../models/roles.model';
import { IRoleRepository } from '../repositories/roles.repository';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import {
    RoleNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';

import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';

// Response DTO type definitions
export interface RoleResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | undefined;
    is_active: boolean;
    profile_ids: string[];
}

export interface IRoleService {
    /**
     * Get role by ID with associated profiles
     */
    getById(roleId: string): Promise<RoleResponseDto>;

    /**
     * Get role by code
     * @throws RoleNotFoundError
     */
    getByCode(code: string): Promise<Roles>;

    /**
     * List all roles in organization with pagination and optional status filter
     */
    listAll(page?: number, limit?: number, status?: 'active' | 'inactive'): Promise<Roles[]>;

    /**
     * Get role hierarchy (ancestors)
     */
    getAncestors(roleId: string): Promise<Roles[]>;

    /**
     * Get child roles
     */
    getChildren(roleId: string): Promise<Roles[]>;

    /**
     * Create new role
     */
    create(
        data: {
            name: string;
            code: string;
            description?: string;
            parent_role_id?: string;
            is_active?: boolean;
            profile_ids?: string[];
        },
        createdBy?: string
    ): Promise<Roles>;

    /**
     * Update role profiles (authoritative set)
     */
    updateRoleProfiles(
        roleId: string,
        profileIds: string[]
    ): Promise<void>;

    /**
     * Update role
     */
    update(
        roleId: string,
        data: Partial<Roles>
    ): Promise<Roles>;

    /**
     * Delete role
     */
    delete(roleId: string): Promise<void>;

    /**
     * Assign role to user
     */
    assignToUser(
        roleId: string,
        userId: string,
        assignedBy?: string
    ): Promise<void>;

    /**
     * Revoke role from user
     */
    revokeFromUser(
        roleId: string,
        userId: string
    ): Promise<void>;

    /**
     * Get all users with this role
     */
    getUsersWithRole(roleId: string): Promise<string[]>;
}

/**
 * RoleService implementation
 */
export class RoleService implements IRoleService {
    constructor(
        private roleRepository: IRoleRepository,
        private userRoleRepository: IUserRoleRepository,
        private roleProfilesRepository: IRoleProfilesRepository
    ) { }

    async getById(roleId: string): Promise<RoleResponseDto> {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        const roleProfiles = await this.roleProfilesRepository.findProfilesByRole(roleId);
        const profileIds = roleProfiles.map(rp => rp.profile_id);

        return {
            id: role.id,
            name: role.name,
            code: role.code,
            description: role.description ?? undefined,
            is_active: role.is_active,
            profile_ids: profileIds
        };
    }

    async getByCode(code: string): Promise<Roles> {
        const role = await this.roleRepository.findByCode(code);
        if (!role) {
            throw new RoleNotFoundError(code);
        }
        return role;
    }

    async listAll(page?: number, limit?: number, status?: 'active' | 'inactive'): Promise<Roles[]> {
        const allRoles = await this.roleRepository.findAll();

        // Filter by status if provided
        let filteredRoles = allRoles;
        if (status === 'active') {
            filteredRoles = allRoles.filter(r => r.is_active);
        } else if (status === 'inactive') {
            filteredRoles = allRoles.filter(r => !r.is_active);
        }

        // Apply pagination if provided
        if (page !== undefined && limit !== undefined) {
            const start = (page - 1) * limit;
            return filteredRoles.slice(start, start + limit);
        }

        return filteredRoles;
    }

    async getAncestors(roleId: string): Promise<Roles[]> {
        return this.roleRepository.findAncestors(roleId);
    }

    async getChildren(roleId: string): Promise<Roles[]> {
        return this.roleRepository.findChildRoles(roleId);
    }

    async create(
        data: {
            name: string;
            code: string;
            description?: string;
            parent_role_id?: string;
            is_active?: boolean;
            profile_ids?: string[];
        },
        createdBy?: string
    ): Promise<Roles> {
        // Check for duplicate code
        const existing = await this.roleRepository.findByCode(data.code);
        if (existing) {
            throw new DuplicateAssignmentError(`role code '${data.code}'`);
        }

        const role = await this.roleRepository.create({
            name: data.name,
            code: data.code,
            description: data.description ?? null,
            parent_role_id: data.parent_role_id ?? null,
            is_active: data.is_active ?? true,
            created_by: createdBy ?? null
        });

        // Assign profiles if provided
        if (data.profile_ids && data.profile_ids.length > 0) {
            await this.roleProfilesRepository.assignAllByRole(role.id, data.profile_ids, createdBy);
        }

        return role;
    }

    async updateRoleProfiles(roleId: string, profileIds: string[]): Promise<void> {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        // Remove all existing profiles first
        await this.roleProfilesRepository.revokeAllByRole(roleId);

        // Assign new profiles
        if (profileIds.length > 0) {
            await this.roleProfilesRepository.assignAllByRole(roleId, profileIds);
        }
    }

    async update(roleId: string, data: Partial<Roles>): Promise<Roles> {
        const existing = await this.roleRepository.findById(roleId);
        if (!existing) {
            throw new RoleNotFoundError(roleId);
        }

        // Check code uniqueness if changing code
        if (data.code && data.code !== existing.code) {
            const codeConflict = await this.roleRepository.findByCode(data.code);
            if (codeConflict) {
                throw new DuplicateAssignmentError(`role code '${data.code}'`);
            }
        }

        return this.roleRepository.update(roleId, data);
    }

    async delete(roleId: string): Promise<void> {
        const existing = await this.roleRepository.findById(roleId);
        if (!existing) {
            throw new RoleNotFoundError(roleId);
        }

        return this.roleRepository.delete(roleId);
    }

    async assignToUser(roleId: string, userId: string, assignedBy?: string): Promise<void> {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.userRoleRepository.assign(userId, roleId, assignedBy);
    }

    async revokeFromUser(roleId: string, userId: string): Promise<void> {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.userRoleRepository.revoke(userId, roleId);
    }

    async getUsersWithRole(roleId: string): Promise<string[]> {
        const userRoles = await this.userRoleRepository.findUsersByRole(roleId);
        return userRoles.map(ur => ur.user_id);
    }
}
