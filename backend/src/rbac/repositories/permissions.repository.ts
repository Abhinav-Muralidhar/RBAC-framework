import { Pool, QueryResultRow } from 'pg';
import { Permissions, PermissionAction } from '../models/permissions.model';
import { PermissionListFilterDto } from '../dto/permission.dto';
import {
    PaginationParams,
    PaginatedResult,
    normalizePaginationParams,
    getPaginationOffset,
    buildPaginatedResult
} from '../utils/pagination.utils';
import { CreatePermissionInput, UpdatePermissionInput } from '../types/repository.types';

// Permission effect from profile_permissions
export type PermissionEffect = 'allow' | 'deny';

export interface IPermissionsRepository {
    findById(id: string): Promise<Permissions | null>;
    findByIdIncludingInactive(id: string): Promise<Permissions | null>;
    findAll(filters?: PermissionListFilterDto): Promise<Permissions[]>;
    findAllPaginated(filters?: PermissionListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Permissions>>;
    findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null>;
    findByIds(ids: string[]): Promise<Permissions[]>;
    create(input: CreatePermissionInput): Promise<Permissions>;
    update(id: string, input: UpdatePermissionInput): Promise<Permissions>;
    delete(id: string): Promise<void>;
    count(filters?: PermissionListFilterDto): Promise<number>;

    /**
     * OPTIMIZED: Single JOIN query to get permission effects for a user on module/action
     * Returns array of 'allow' or 'deny' effects
     */
    findEffectsByUserAndModuleAction(userId: string, moduleCode: string, action: PermissionAction): Promise<PermissionEffect[]>;
}

const ACTIVE_FILTER = `is_active = true`;

export class PermissionsRepository implements IPermissionsRepository {
    private tableName = 'permissions';

    constructor(private pool: InstanceType<typeof Pool>) { }

    private async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
        return this.pool.query<T>(text, params);
    }

    async findById(id: string): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}`,
            [id]
        );
        return res.rows[0] ?? null;
    }

    async findByIdIncludingInactive(id: string): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return res.rows[0] ?? null;
    }

    async findAll(filters?: PermissionListFilterDto): Promise<Permissions[]> {
        let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
        const params: unknown[] = [];
        let paramIndex = 1;

        if (filters) {
            if (filters.module_id) {
                params.push(filters.module_id);
                sql += ` AND module_id = $${paramIndex++}`;
            }
            if (filters.action) {
                params.push(filters.action);
                sql += ` AND action = $${paramIndex++}`;
            }
        }

        const res = await this.query<Permissions>(sql, params);
        return res.rows;
    }

    async findAllPaginated(
        filters?: PermissionListFilterDto,
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Permissions>> {
        const normalizedPagination = normalizePaginationParams(pagination);
        const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

        const total = await this.count(filters);

        let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
        const params: unknown[] = [];
        let paramIndex = 1;

        if (filters?.module_id) {
            params.push(filters.module_id);
            sql += ` AND module_id = $${paramIndex++}`;
        }
        if (filters?.action) {
            params.push(filters.action);
            sql += ` AND action = $${paramIndex++}`;
        }

        sql += ` ORDER BY module_id, action LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(normalizedPagination.limit, offset);

        const res = await this.query<Permissions>(sql, params);
        return buildPaginatedResult(res.rows, total, normalizedPagination);
    }

    async count(filters?: PermissionListFilterDto): Promise<number> {
        let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
        const params: unknown[] = [];
        let paramIndex = 1;

        if (filters?.module_id) {
            params.push(filters.module_id);
            sql += ` AND module_id = $${paramIndex++}`;
        }
        if (filters?.action) {
            params.push(filters.action);
            sql += ` AND action = $${paramIndex++}`;
        }

        const res = await this.query<{ count: string }>(sql, params);
        return parseInt(res.rows[0]?.count ?? '0', 10);
    }

    async findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND action = $2 AND ${ACTIVE_FILTER}`,
            [moduleId, action]
        );
        return res.rows[0] ?? null;
    }

    async findByIds(ids: string[]): Promise<Permissions[]> {
        if (!ids.length) return [];
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders}) AND ${ACTIVE_FILTER}`,
            ids
        );
        return res.rows;
    }

    /**
     * OPTIMIZED PERMISSION CHECK
     * 
     * Single JOIN query that traverses:
     * users -> user_roles -> role_profiles -> profile_permissions -> permissions -> modules
     * 
     * Returns all permission effects (allow/deny) for the user on the given module/action.
     */
    async findEffectsByUserAndModuleAction(
        userId: string,
        moduleCode: string,
        action: PermissionAction
    ): Promise<PermissionEffect[]> {
        const query = `
            SELECT DISTINCT pp.effect
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN role_profiles rp ON rp.role_id = ur.role_id
            JOIN profile_permissions pp ON pp.profile_id = rp.profile_id
            JOIN permissions p ON p.id = pp.permission_id
            JOIN modules m ON m.id = p.module_id
            WHERE u.id = $1 
              AND u.status NOT IN ('deleted', 'inactive')
              AND m.code = $2 
              AND m.is_active = true
              AND p.action = $3
              AND p.is_active = true
        `;

        const res = await this.query<{ effect: PermissionEffect }>(query, [userId, moduleCode, action]);
        return res.rows.map(row => row.effect);
    }

    async create(input: CreatePermissionInput): Promise<Permissions> {
        const res = await this.query<Permissions>(
            `INSERT INTO ${this.tableName} (action, module_id, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [input.action, input.module_id, input.description ?? null]
        );
        if (!res.rows[0]) throw new Error('Permission creation failed');
        return res.rows[0];
    }

    async update(id: string, input: UpdatePermissionInput): Promise<Permissions> {
        const updates: string[] = [];
        const values: unknown[] = [id];
        let paramIdx = 2;

        if (input.action !== undefined) {
            updates.push(`action = $${paramIdx++}`);
            values.push(input.action);
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramIdx++}`);
            values.push(input.description);
        }

        if (!updates.length) {
            const existing = await this.findById(id);
            if (!existing) throw new Error(`Permission ${id} not found`);
            return existing;
        }

        const res = await this.query<Permissions>(
            `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = $1 AND ${ACTIVE_FILTER} RETURNING *`,
            values
        );

        if (!res.rows.length) throw new Error(`Permission ${id} not found for update`);
        return res.rows[0]!;
    }

    async delete(id: string): Promise<void> {
        await this.query(`UPDATE ${this.tableName} SET is_active = false WHERE id = $1`, [id]);
    }
}
