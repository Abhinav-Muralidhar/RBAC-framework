import { Pool, QueryResultRow } from 'pg';
import { Organizations } from '../models/organizations.model';

export interface IOrganizationRepository {
    /** Fetch the single organization */
    get(): Promise<Organizations | null>;

    /** Update the organization details */
    update(data: Partial<Organizations>): Promise<Organizations>;
    delete(id: string): Promise<void>;
}

export class OrganizationRepository implements IOrganizationRepository {
    private tableName = 'organizations';
    private orgId = '1'; // fixed ID for single org

    constructor(private pool: InstanceType<typeof Pool>) { }

    protected async query<T extends QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<{ rows: T[] }> {
        return this.pool.query<T>(text, params);
    }

    async get(): Promise<Organizations | null> {
        const res = await this.query<Organizations>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [this.orgId]
        );
        return res.rows[0] ?? null;
    }

    async update(data: Partial<Organizations>): Promise<Organizations> {
        const keys = Object.keys(data);
        if (keys.length === 0) throw new Error('No fields provided for update');

        const values = Object.values(data);
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const query = `
            UPDATE ${this.tableName}
            SET ${setClause}, updated_at = NOW()
            WHERE id = $${keys.length + 1}
            RETURNING *
        `;

        const res = await this.query<Organizations>(query, [...values, this.orgId]);
        if (!res.rows.length) throw new Error('Organization not found for update');

        return res.rows[0]!;
    }
    async delete(id: string): Promise<void> {
        await this.query(
            `UPDATE ${this.tableName} SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }
}
