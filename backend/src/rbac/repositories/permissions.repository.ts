import { Pool, QueryResultRow } from 'pg';
import { Permissions, PermissionAction } from '../models/permissions.model';

export interface IPermissionsRepository {
    findById(id: string): Promise<Permissions | null>;
    findAll(): Promise<Permissions[]>;
    findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null>;
    findByIds(ids: string[]): Promise<Permissions[]>;
    create(data: Record<string, unknown>): Promise<Permissions>;
    update(id: string, data: Record<string, unknown>): Promise<Permissions>;
    delete(id: string): Promise<void>;
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
        return res.rows[0] || null;
    }

    async findAll(): Promise<Permissions[]> {
        const res = await this.query<Permissions>(`SELECT * FROM ${this.tableName}`);
        return res.rows;
    }

    async findByModuleAndAction(moduleId: string, action: PermissionAction): Promise<Permissions | null> {
        const res = await this.query<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND action = $2`,
            [moduleId, action]
        );
        return res.rows[0] || null;
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

    async create(data: Record<string, unknown>): Promise<Permissions> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const columns = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const res = await this.query<Permissions>(
            `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        return res.rows[0]!;
    }

    async update(id: string, data: Record<string, unknown>): Promise<Permissions> {
        const keys = Object.keys(data);
        const values = Object.values(data);
        if (!keys.length) return this.findById(id) as Promise<Permissions>;

        const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
        const res = await this.query<Permissions>(
            `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );

        if (!res.rows.length) throw new Error(`Permissions ${id} not found for update`);
        return res.rows[0]!;
    }

    async delete(id: string): Promise<void> {
        await this.query(`UPDATE ${this.tableName} SET is_active = false WHERE id = $1`, [id]);
    }
}
