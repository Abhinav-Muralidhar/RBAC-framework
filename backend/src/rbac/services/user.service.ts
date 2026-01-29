/**
 * UserService
 * 
 * Business logic for user management.
 */

import { IUsersRepository } from '../repositories/users.repository';
import { Users } from '../models/users.model';
import { hashPassword } from '../utils/crypto.utils';

export interface IUserService {
    list(filters?: Record<string, unknown>): Promise<Users[]>;
    getById(id: string): Promise<Users | null>;
    create(data: Partial<Users> & { password?: string }): Promise<Users>;
    update(id: string, data: Partial<Users> & { password?: string }): Promise<Users>;
    delete(id: string): Promise<void>;
}

export class UserService implements IUserService {
    constructor(private userRepository: IUsersRepository) { }

    async list(filters?: Record<string, unknown>): Promise<Users[]> {
        return this.userRepository.findAll(filters);
    }

    async getById(id: string): Promise<Users | null> {
        return this.userRepository.findById(id);
    }

    async create(data: Partial<Users> & { password?: string }): Promise<Users> {
        // Hash password if provided
        if (data.password) {
            data.password = await hashPassword(data.password);
        }
        return this.userRepository.create(data);
    }

    async update(id: string, data: Partial<Users> & { password?: string }): Promise<Users> {
        if (data.password) {
            data.password = await hashPassword(data.password);
        }
        return this.userRepository.update(id, data);
    }

    async delete(id: string): Promise<void> {
        return this.userRepository.delete(id);
    }
}
