import { Pool, QueryResultRow } from 'pg';
import { Permission, PermissionAction } from '../models/permission.model';

export interface IPermissionRepository {
    findById(id: string): Promise<Permission | null>;
    findAll(): Promise<Permission[]>;
    findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permission | null>;
    findByIds(ids: string[]): Promise<Permission[]>;
    create(data: Record<string, unknown>): Promise<Permission>;
    update(id: string, data: Record<string, unknown>): Promise<Permission>;
    delete(id: string): Promise<void>;
}

export class PermissionRepository implements IPermissionRepository {
    private tableName = 'permissions';

    constructor(private pool: InstanceType<typeof Pool>) {}

    private async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
        return this.pool.query<T>(text, params);
    }

    async findById(id: string): Promise<Permission | null> {
        const res = await this.query<Permission>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return res.rows[0] || null;
    }

    async findAll(): Promise<Permission[]> {
        const res = await this.query<Permission>(`SELECT * FROM ${this.tableName}`);
        return res.rows;
    }

    async findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permission | null> {
        const res = await this.query<Permission>(
            `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND action = $2`,
            [moduleId, action]
        );
        return res.rows[0] || null;
    }

    async findByIds(ids: string[]): Promise<Permission[]> {
        if (!ids.length) return [];
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        const res = await this.query<Permission>(
            `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`,
            ids
        );
        return res.rows;
    }

    async create(data: Record<string, unknown>): Promise<Permission> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const columns = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const res = await this.query<Permission>(
            `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        return res.rows[0]!;
    }

    async update(id: string, data: Record<string, unknown>): Promise<Permission> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        if (!keys.length) return this.findById(id) as Promise<Permission>;

        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
        const res = await this.query<Permission>(
            `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );

        if (!res.rows.length) throw new Error(`Permission ${id} not found for update`);
        return res.rows[0]!;
    }

    async delete(id: string): Promise<void> {
        await this.query(`UPDATE ${this.tableName} SET is_active = false WHERE id = $1`, [id]);
    }
}
