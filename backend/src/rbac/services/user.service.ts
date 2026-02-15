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
    create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto, auditCtx?: AuditContext): Promise<Users>;
    update(t: TransactionTask, actingUserId: string, id: string, data: UpdateUserRequestDto, auditCtx?: AuditContext): Promise<Users>;
    delete(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void>;
    getById(t: TransactionTask, actingUserId: string, id: string): Promise<UserDetail | null>;
    findByUsername(t: TransactionTask, username: string): Promise<Users | null>;
    findByEmail(t: TransactionTask, email: string): Promise<Users | null>;
    updatePassword(t: TransactionTask, userId: string, newHashedPassword: string, auditCtx?: AuditContext): Promise<void>;
    recordLogin(t: TransactionTask, userId: string): Promise<void>;
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

    async create(t: TransactionTask, actingUserId: string, data: CreateUserRequestDto, auditCtx?: AuditContext): Promise<Users> {
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
            new_values: { ...data, password: '[PASSWORD]' } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return user;
    }

    async update(
        t: TransactionTask,
        actingUserId: string,
        id: string,
        data: UpdateUserRequestDto,
        auditCtx?: AuditContext
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
            last_login_at: cleanData.last_login_at !== undefined ? (cleanData.last_login_at as Date | null) : (oldUser.last_login_at ?? null),
            password_changed_at: oldUser.password_changed_at ?? null,
        };

        const updatedUser = await this.userRepository.update(t, updateUserData);
        const updateUserDetail = await this.userRepository.findByIdWithDetails(t, id);
        if (!updateUserDetail) throw new Error('User not found');
        if (data.rolesid) {
            await this.userRolesRepository.revokeAllByUser(t, id);
            await this.userRolesRepository.assign(t, id, data.rolesid);
        }


        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown>,
            new_values: { ...updatedUser, password: '[PASSWORD]' } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })

        return updatedUser;
    }


    async delete(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.delete(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown> : null,
            new_values: oldUser ? { delete: true, actingUserId: actingUserId } as Record<string, unknown> : {},
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }

    async deactivate(t: TransactionTask, actingUserId: string, id: string, auditCtx?: AuditContext): Promise<void> {
        const oldUser = await this.userRepository.findById(t, id);

        await this.userRepository.deactivate(t, id);

        await this.auditService.log(t, {
            user_id: actingUserId,
            action: 'delete',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[PASSWORD]' } as Record<string, unknown> : null,
            new_values: oldUser ? { delete: true, actingUserId: actingUserId } as Record<string, unknown> : {},
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        })
    }

    async updatePassword(
        t: TransactionTask,
        userId: string,
        newHashedPassword: string,
        auditCtx?: AuditContext
    ): Promise<void> {

        const oldUser = await this.userRepository.findById(t, userId);
        if (!oldUser) throw new Error('User not found');

        const updatedUser: Users = {
            ...oldUser,
            password: newHashedPassword,
            password_changed_at: new Date()
        };

        await this.userRepository.update(t, updatedUser);

        // ✅ Audit only here (important change)
        await this.auditService.log(t, {
            user_id: userId,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'user',
            entity_id: userId,
            old_values: { password: '[REDACTED]' },
            new_values: { password: '[REDACTED]' },
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
    }

    async recordLogin(t: TransactionTask, userId: string): Promise<void> {
        await this.userRepository.updateLastLoginAt(t, userId, new Date());
    }
}
