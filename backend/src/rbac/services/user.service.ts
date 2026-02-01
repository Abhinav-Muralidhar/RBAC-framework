/**
 * UserService
 * 
 * Business logic for user management.
 * All mutating operations require RBAC enforcement.
 * All mutations are audit logged.
 */

import { IUsersRepository } from '../repositories/users.repository';
import { Users } from '../models/users.model';
import { hashPassword, validatePassword } from '../utils/crypto.utils';
import { IEvaluationService } from './evaluation.service';
import { IAuditService } from './audit.service';
import { UserListFilterDto, CreateUserRequestDto, UpdateUserRequestDto } from '../dto/user.dto';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';

// Module code for RBAC operations
const MODULE_CODE = 'SETTINGS';

export interface IUserService {
    list(actingUserId: string, filters?: UserListFilterDto): Promise<Users[]>;
    listPaginated(actingUserId: string, filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
    getById(actingUserId: string, id: string): Promise<Users | null>;
    create(actingUserId: string, data: CreateUserRequestDto): Promise<Users>;
    update(actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users>;
    delete(actingUserId: string, id: string): Promise<void>;
}

export class UserService implements IUserService {
    constructor(
        private userRepository: IUsersRepository,
        private evaluationService: IEvaluationService,
        private auditService: IAuditService
    ) { }

    async list(actingUserId: string, filters?: UserListFilterDto): Promise<Users[]> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.userRepository.findAll(filters);
    }

    async listPaginated(
        actingUserId: string,
        filters?: UserListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Users>> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.userRepository.findAllPaginated(filters, pagination);
    }

    async getById(actingUserId: string, id: string): Promise<Users | null> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'read');
        return this.userRepository.findById(id);
    }

    async create(actingUserId: string, data: CreateUserRequestDto): Promise<Users> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'create');

        // Clone input to avoid mutation side effects
        const userData = { ...data };

        // Validate and hash password
        if (userData.password) {
            validatePassword(userData.password);
            userData.password = await hashPassword(userData.password);
        }

        const user = await this.userRepository.create(userData);

        // AUDIT: Log user creation (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'create',
            entity_type: 'user',
            entity_id: user.id,
            old_values: null,
            new_values: { ...data, password: '[REDACTED]' },
            status: 'success'
        }).catch(console.error);

        return user;
    }

    async update(actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        // Fetch old values for audit
        const oldUser = await this.userRepository.findById(id);

        // Clone input to avoid mutation side effects
        const userData = { ...data };

        // Validate and hash password if changing
        if (userData.password) {
            validatePassword(userData.password);
            userData.password = await hashPassword(userData.password);
        }

        const updatedUser = await this.userRepository.update(id, userData);

        // AUDIT: Log user update (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'update',
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[REDACTED]' } : null,
            new_values: { ...data, password: data.password ? '[REDACTED]' : undefined },
            status: 'success'
        }).catch(console.error);

        return updatedUser;
    }

    async delete(actingUserId: string, id: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');

        // Fetch old values for audit
        const oldUser = await this.userRepository.findById(id);

        await this.userRepository.delete(id);

        // AUDIT: Log user deletion (fire-and-forget)
        this.auditService.log({
            user_id: actingUserId,
            action: 'delete',
            entity_type: 'user',
            entity_id: id,
            old_values: oldUser ? { ...oldUser, password: '[REDACTED]' } : null,
            new_values: { is_deleted: true },
            status: 'success'
        }).catch(console.error);
    }
}
