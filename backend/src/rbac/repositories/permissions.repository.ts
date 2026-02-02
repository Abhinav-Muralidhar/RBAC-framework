import { Pool, QueryResultRow } from 'pg';
import { Permissions, PermissionAction } from '../models/permissions.model';
import { CreatePermissionInput } from '../types/repository.types';
export type PermissionEffect = 'allow' | 'deny';

export interface IPermissionsRepository {
    findById(id: string): Promise<Permissions | null>;
    findAll(): Promise<Permissions[]>;
    findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null>;
    findByIds(ids: string[]): Promise<Permissions[]>;
    create(input: CreatePermissionInput): Promise<Permissions>;
    update(id: string, input: Permissions): Promise<Permissions>;
    delete(id: string): Promise<void>;
    findEffectsByUserAndModuleAction(userId: string, moduleCode: string, action: PermissionAction): Promise<PermissionEffect[]>;
}


export class PermissionsRepository implements IPermissionsRepository {
    private tableName = 'permissions';

    constructor(private pool: InstanceType<typeof Pool>) { }

    private async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
        return this.pool.query<T>(text, params);
    }

    async findById(id: string): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return res.rows[0] ?? null;
    }


    async findAll(): Promise<Permissions[]> {
        let sql = `SELECT * FROM ${this.tableName}`;
        const params: unknown[] = [];
        let paramIndex = 1;

        const res = await this.query<Permissions>(sql, params);
        return res.rows;
    }

    async findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND action = $2`,
            [moduleId, action]
        );
        return res.rows[0] ?? null;
    }

    async findByIds(ids: string[]): Promise<Permissions[]> {
        if (!ids.length) return [];
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`,
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
            JOIN profiles po ON po.id = rp.profile_id
            JOIN profile_permissions pp ON pp.profile_id = po.id
            JOIN permissions p ON p.id = pp.permission_id
            JOIN modules m ON m.id = p.module_id
            WHERE u.id = $1
                AND u.status NOT IN ('deleted', 'inactive')
                AND po.is_active = true
                AND m.code = $2
                AND p.action = $3;
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

    async update(id: string, input: Permissions): Promise<Permissions> {
        const res = await this.query<Permissions>(
            `UPDATE ${this.tableName} SET action = $2, description = $3 WHERE id = $1 RETURNING *`,
            [id, input.action, input.description ?? null]
        );

        if (!res.rows.length) throw new Error(`Permission ${id} not found for update`);
        return res.rows[0]!;
    }

    async delete(id: string): Promise<void> {
        await this.query(`UPDATE ${this.tableName} SET is_active = false WHERE id = $1`, [id]);
    }
}
