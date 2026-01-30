/**
 * RoleService
 * 
 * Business logic for role management.
 * All mutating operations require RBAC enforcement.
 */

import { Roles } from '../models/roles.model';
import { IRoleRepository } from '../repositories/roles.repository';
import { IUserRoleRepository } from '../repositories/user_roles.repository';
import { IRoleProfilesRepository } from '../repositories/role_profiles.repository';
import { IEvaluationService } from './evaluation.service';
import {
    RoleNotFoundError,
    DuplicateAssignmentError
} from '../errors/rbac.errors';
import { RoleListFilterDto, CreateRoleRequestDto, UpdateRoleRequestDto } from '../dto/role.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

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
    getById(actingUserId: string, roleId: string): Promise<RoleResponseDto>;
    getByCode(actingUserId: string, code: string): Promise<Roles>;
    listAll(actingUserId: string, page?: number, limit?: number, status?: 'active' | 'inactive'): Promise<Roles[]>;
    listPaginated(actingUserId: string, filters?: RoleListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
    getAncestors(actingUserId: string, roleId: string): Promise<Roles[]>;
    getChildren(actingUserId: string, roleId: string): Promise<Roles[]>;
    create(actingUserId: string, data: CreateRoleRequestDto): Promise<Roles>;
    updateRoleProfiles(actingUserId: string, roleId: string, profileIds: string[]): Promise<void>;
    update(actingUserId: string, roleId: string, data: UpdateRoleRequestDto): Promise<Roles>;
    delete(actingUserId: string, roleId: string): Promise<void>;
    assignToUser(actingUserId: string, roleId: string, userId: string): Promise<void>;
    revokeFromUser(actingUserId: string, roleId: string, userId: string): Promise<void>;
    getUsersWithRole(actingUserId: string, roleId: string): Promise<string[]>;
}

export class RoleService implements IRoleService {
    constructor(
        private roleRepository: IRoleRepository,
        private userRoleRepository: IUserRoleRepository,
        private roleProfilesRepository: IRoleProfilesRepository,
        private evaluationService: IEvaluationService
    ) { }

    async getById(actingUserId: string, roleId: string): Promise<RoleResponseDto> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

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

    async getByCode(actingUserId: string, code: string): Promise<Roles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const role = await this.roleRepository.findByCode(code);
        if (!role) {
            throw new RoleNotFoundError(code);
        }
        return role;
    }

    async listAll(actingUserId: string, page?: number, limit?: number, status?: 'active' | 'inactive'): Promise<Roles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const allRoles = await this.roleRepository.findAll();

        let filteredRoles = allRoles;
        if (status === 'active') {
            filteredRoles = allRoles.filter(r => r.is_active);
        } else if (status === 'inactive') {
            filteredRoles = allRoles.filter(r => !r.is_active);
        }

        if (page !== undefined && limit !== undefined) {
            const start = (page - 1) * limit;
            return filteredRoles.slice(start, start + limit);
        }

        return filteredRoles;
    }

    async listPaginated(
        actingUserId: string,
        filters?: RoleListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Roles>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.roleRepository.findAllPaginated(filters, pagination);
    }

    async getAncestors(actingUserId: string, roleId: string): Promise<Roles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.roleRepository.findAncestors(roleId);
    }

    async getChildren(actingUserId: string, roleId: string): Promise<Roles[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.roleRepository.findChildRoles(roleId);
    }

    async create(actingUserId: string, data: CreateRoleRequestDto): Promise<Roles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

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
            created_by: actingUserId
        });

        if (data.profile_ids && data.profile_ids.length > 0) {
            await this.roleProfilesRepository.assignAllByRole(role.id, data.profile_ids, actingUserId);
        }

        return role;
    }

    async updateRoleProfiles(actingUserId: string, roleId: string, profileIds: string[]): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.roleProfilesRepository.revokeAllByRole(roleId);

        if (profileIds.length > 0) {
            await this.roleProfilesRepository.assignAllByRole(roleId, profileIds, actingUserId);
        }
    }

    async update(actingUserId: string, roleId: string, data: UpdateRoleRequestDto): Promise<Roles> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const existing = await this.roleRepository.findById(roleId);
        if (!existing) {
            throw new RoleNotFoundError(roleId);
        }

        if (data.code && data.code !== existing.code) {
            const codeConflict = await this.roleRepository.findByCode(data.code);
            if (codeConflict) {
                throw new DuplicateAssignmentError(`role code '${data.code}'`);
            }
        }

        return this.roleRepository.update(roleId, data);
    }

    async delete(actingUserId: string, roleId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        const existing = await this.roleRepository.findById(roleId);
        if (!existing) {
            throw new RoleNotFoundError(roleId);
        }

        return this.roleRepository.delete(roleId);
    }

    async assignToUser(actingUserId: string, roleId: string, userId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.userRoleRepository.assign(userId, roleId, actingUserId);
    }

    async revokeFromUser(actingUserId: string, roleId: string, userId: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        await this.userRoleRepository.revoke(userId, roleId);
    }

    async getUsersWithRole(actingUserId: string, roleId: string): Promise<string[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        const userRoles = await this.userRoleRepository.findUsersByRole(roleId);
        return userRoles.map(ur => ur.user_id);
    }
}
