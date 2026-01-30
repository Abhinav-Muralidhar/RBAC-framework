/**
 * UserService
 * 
 * Business logic for user management.
 * All mutating operations require RBAC enforcement.
 */

import { IUsersRepository } from '../repositories/users.repository';
import { Users } from '../models/users.model';
import { hashPassword, validatePassword } from '../utils/crypto.utils';
import { IEvaluationService } from './evaluation.service';
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
        private evaluationService: IEvaluationService
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

        // Validate and hash password
        if (data.password) {
            validatePassword(data.password);
            data.password = await hashPassword(data.password);
        }

        return this.userRepository.create(data);
    }

    async update(actingUserId: string, id: string, data: UpdateUserRequestDto): Promise<Users> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'update');

        // Validate and hash password if changing
        if (data.password) {
            validatePassword(data.password);
            data.password = await hashPassword(data.password);
        }

        return this.userRepository.update(id, data);
    }

    async delete(actingUserId: string, id: string): Promise<void> {
        await this.evaluationService.enforcePermission(actingUserId, MODULE_CODE, 'delete');
        return this.userRepository.delete(id);
    }
}
