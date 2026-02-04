/**
 * UserService
 * 
 * Business logic for user management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { IDatabase } from 'pg-promise';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';
import { IUsersRepository, UserDetail } from '../repositories/users.repository';
import { Users, UserStatus } from '../models/users.model';
import { hashPassword, validatePassword } from '../utils/crypto.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { UserListFilterDto, CreateUserRequestDto, UpdateUserRequestDto } from '../dto/user.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { CreateUserInput, UpdateUserInput } from '../types/repository.types';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUserService {
    listPaginated(actingUserId: string, filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
    create(actingUserId: string, data: CreateUserRequestDto): Promise<Users>;
    update(actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users>;
    delete(actingUserId: string, id: string): Promise<void>;
    getById(actingUserId: string, id: string): Promise<UserDetail | null>;
    findByUsername(username: string): Promise<Users | null>;
}

export class UserService implements IUserService {
    constructor(
        private userRepository: IUsersRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService,
    ) { }

    async findByUsername(username: string): Promise<Users | null> {
        return withTransaction(async (t: TransactionTask) => {
            return this.userRepository.findByUsername(t, username);
        });
    }


    async listPaginated(
        actingUserId: string,
        filters?: UserListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Users>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        return withTransaction(async (t: TransactionTask) => {
            return this.userRepository.findAllPaginated(t, filters, pagination);
        });
    }

    async getById(actingUserId: string, id: string): Promise<UserDetail | null> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');

        return withTransaction(async (t: TransactionTask) => {
            return this.userRepository.findByIdWithDetails(t, id);
        });
    }

    async create(actingUserId: string, data: CreateUserRequestDto): Promise<Users> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');
        return withTransaction(async (t: TransactionTask) => {
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

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'create',
                entity_type: 'user',
                entity_id: user.id,
                old_values: null,
                new_values: { ...data, password: '[REDACTED]' },
                status: 'success'
            }).catch(console.error);

            return user;
        });
    }

    async update(actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        return withTransaction(async (t: TransactionTask) => {
            const oldUser = await this.userRepository.findById(t, id);

            const userData = { ...data } as any;

            if (userData.password) {
                validatePassword(userData.password);
                userData.password = await hashPassword(userData.password);
            }

            const updateUserData: Users = {
                ...oldUser!,
                ...data,
                id: id,
                created_at: oldUser!.created_at,
                status: data.status ?? oldUser!.status,
                last_login_at: null,
                password_changed_at: null,
            };

            const updatedUser = await this.userRepository.update(t, updateUserData);

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'update',
                entity_type: 'user',
                entity_id: id,
                old_values: oldUser ? { ...oldUser, password: '[REDACTED]' } : null,
                new_values: { ...data, password: data.password ? '[REDACTED]' : undefined },
                status: 'success'
            }).catch(console.error);

            return updatedUser;
        });
    }

    async delete(actingUserId: string, id: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        return withTransaction(async (t: TransactionTask) => {
            const oldUser = await this.userRepository.findById(t, id);

            await this.userRepository.delete(t, id);

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'delete',
                entity_type: 'user',
                entity_id: id,
                old_values: oldUser ? { ...oldUser, password: '[REDACTED]' } : null,
                new_values: { status: 'deleted' },
                status: 'success'
            }).catch(console.error);
        });
    }

    async deactivate(actingUserId: string, id: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        return withTransaction(async (t: TransactionTask) => {
            const oldUser = await this.userRepository.findById(t, id);

            await this.userRepository.deactivate(t, id);

            this.auditService.log(t, {
                user_id: actingUserId,
                action: 'delete',
                entity_type: 'user',
                entity_id: id,
                old_values: oldUser ? { ...oldUser, password: '[REDACTED]' } : null,
                new_values: { status: 'inactive' },
                status: 'success'
            }).catch(console.error);
        });
    }
}
