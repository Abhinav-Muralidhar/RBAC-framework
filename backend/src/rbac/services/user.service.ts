/**
 * UserService
 * 
 * Business logic for user management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { TransactionTask } from '../utils/transaction.utils';
import { IUsersRepository, UserDetail } from '../repositories/users.repository';
import { Users, UserStatus } from '../models/users.model';
import { hashPassword, validatePassword } from '../utils/crypto.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { UserListFilterDto, CreateUserRequestDto, UpdateUserRequestDto } from '../dto/user.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { CreateUserInput, UpdateUserInput } from '../types/repository.types';
import { IUserRoleRepository } from '../repositories/user_roles.repository';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUserService {
    listPaginated(t: TransactionTask, actingUserId: string, filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
    create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto): Promise<Users>;
    update(t: TransactionTask, actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users>;
    delete(t: TransactionTask, actingUserId: string, id: string): Promise<void>;
    getById(t: TransactionTask, actingUserId: string, id: string): Promise<UserDetail | null>;
    findByUsername(t: TransactionTask, username: string): Promise<Users | null>;
    findByEmail(t: TransactionTask, email: string): Promise<Users | null>;
}

export class UserService implements IUserService {
    constructor(
        private userRepository: IUsersRepository,
        private userRolesRepository: IUserRoleRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
    ) { }

    async findByUsername(t: TransactionTask, username: string): Promise<Users | null> {
        return this.userRepository.findByUsername(t, username);
    }

    async findByEmail(t: TransactionTask, email: string): Promise<Users | null> {
        return this.userRepository.findByEmail(t, email);
    }

    async listPaginated(
        t: TransactionTask,
        actingUserId: string,
        filters?: UserListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Users>> {

        return this.userRepository.findAllPaginated(t, filters, pagination);
    }

    async getById(t: TransactionTask, actingUserId: string, id: string): Promise<UserDetail | null> {
        return this.userRepository.findByIdWithDetails(t, id);
    }

    async create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto): Promise<Users> {
        if (data.password) {
            validatePassword(data.password);
            data.password = await hashPassword(data.password);
        }

        const userData: CreateUserInput = {
            ...data,
            username: data.username,
            password: data.password,
            primary_email: data.primary_email,
            last_name: data.last_name,

        };

        const user = await this.userRepository.create(t, userData);
        await this.userRolesRepository.assign(t, user.id, data.rolesid as string);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: user.id,
            old_values: null,
            new_values: { user_id: user.id, username: user.username, primary_email: user.primary_email, last_name: user.last_name, password: '[REDACTED]' },
            status: 'success'
        })

        return user;
    }

    async update(
        t: TransactionTask,
        actingUserId: string,
        id: string,
        data: UpdateUserRequestDto
    ): Promise<Users> {
        const oldUser = await this.userRepository.findById(t, id);
        if (!oldUser) throw new Error('User not found');

        const userData: any = { ...data };

        if (userData.password) {
            validatePassword(userData.password);
            userData.password = await hashPassword(userData.password);
        }

        const cleanData = Object.fromEntries(
            Object.entries(userData).filter(([_, v]) => v !== undefined)
        );

        const updateUserData: Users = {
            ...oldUser,
            ...cleanData,
            id,
            created_at: oldUser.created_at,
            status: data.status ?? oldUser.status,
            last_login_at: oldUser.last_login_at ?? null,
            password_changed_at: oldUser.password_changed_at ?? null,
        };

        const updatedUser = await this.userRepository.update(t, updateUserData);
        const updateUserDetail = await this.userRepository.findByIdWithDetails(t, id);
        if (!updateUserDetail) throw new Error('User not found');
        await this.userRolesRepository.revokeAllByUser(t, id);
        await this.userRolesRepository.assign(t, id, updateUserDetail.rolesid as string);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: { user_id: oldUser.id, username: oldUser.username, primary_email: oldUser.primary_email, last_name: oldUser.last_name, password: '[REDACTED]' },
            new_values: { user_id: updatedUser.id, username: updatedUser.username, primary_email: updatedUser.primary_email, last_name: updatedUser.last_name, password: updatedUser.password ? '[REDACTED]' : undefined },
            status: 'success'
        })

        return updatedUser;
    }


    async delete(t: TransactionTask, actingUserId: string, id: string): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.delete(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { user_id: oldUser.id, username: oldUser.username, primary_email: oldUser.primary_email, last_name: oldUser.last_name, password: '[REDACTED]' } : null,
            new_values: oldUser ? { user_id: oldUser.id, username: oldUser.username, primary_email: oldUser.primary_email, last_name: oldUser.last_name, password: '[REDACTED]' } : {},
            status: 'success'
        })
    }

    async deactivate(t: TransactionTask, actingUserId: string, id: string): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.deactivate(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { user_id: oldUser.id, username: oldUser.username, primary_email: oldUser.primary_email, last_name: oldUser.last_name, password: '[REDACTED]' } : null,
            new_values: oldUser ? { user_id: oldUser.id, username: oldUser.username, primary_email: oldUser.primary_email, last_name: oldUser.last_name, password: '[REDACTED]' } : {},
            status: 'success'
        })
    }
}
