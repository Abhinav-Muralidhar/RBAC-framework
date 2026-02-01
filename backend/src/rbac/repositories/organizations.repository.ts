import { Pool, QueryResultRow } from 'pg';
import { Organizations } from '../models/organizations.model';
import { UpdateOrganizationInput } from '../types/repository.types';

export interface IOrganizationRepository {
    /** Fetch the single organization */
    get(): Promise<Organizations | null>;

    /** Update the organization details */
    update(input: UpdateOrganizationInput): Promise<Organizations>;
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

    async update(input: UpdateOrganizationInput): Promise<Organizations> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIdx = 1;

        if (input.company_name !== undefined) {
            updates.push(`company_name = $${paramIdx++}`);
            values.push(input.company_name);
        }
        if (input.company_logo !== undefined) {
            updates.push(`company_logo = $${paramIdx++}`);
            values.push(input.company_logo);
        }
        if (input.address !== undefined) {
            updates.push(`address = $${paramIdx++}`);
            values.push(input.address);
        }
        if (input.city !== undefined) {
            updates.push(`city = $${paramIdx++}`);
            values.push(input.city);
        }
        if (input.state !== undefined) {
            updates.push(`state = $${paramIdx++}`);
            values.push(input.state);
        }
        if (input.postal_code !== undefined) {
            updates.push(`postal_code = $${paramIdx++}`);
            values.push(input.postal_code);
        }
        if (input.country !== undefined) {
            updates.push(`country = $${paramIdx++}`);
            values.push(input.country);
        }
        if (input.country_code !== undefined) {
            updates.push(`country_code = $${paramIdx++}`);
            values.push(input.country_code);
        }
        if (input.phone !== undefined) {
            updates.push(`phone = $${paramIdx++}`);
            values.push(input.phone);
        }
        if (input.fax !== undefined) {
            updates.push(`fax = $${paramIdx++}`);
            values.push(input.fax);
        }
        if (input.website !== undefined) {
            updates.push(`website = $${paramIdx++}`);
            values.push(input.website);
        }
        if (input.facebook !== undefined) {
            updates.push(`facebook = $${paramIdx++}`);
            values.push(input.facebook);
        }
        if (input.twitter !== undefined) {
            updates.push(`twitter = $${paramIdx++}`);
            values.push(input.twitter);
        }
        if (input.linkedin !== undefined) {
            updates.push(`linkedin = $${paramIdx++}`);
            values.push(input.linkedin);
        }
        if (input.financial_year_start_month !== undefined) {
            updates.push(`financial_year_start_month = $${paramIdx++}`);
            values.push(input.financial_year_start_month);
        }
        if (input.gstin !== undefined) {
            updates.push(`gstin = $${paramIdx++}`);
            values.push(input.gstin);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramIdx++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            throw new Error('No fields provided for update');
        }

        updates.push('updated_at = NOW()');
        values.push(this.orgId);

        const res = await this.query<Organizations>(
            `UPDATE ${this.tableName}
             SET ${updates.join(', ')}
             WHERE id = $${paramIdx}
             RETURNING *`,
            values
        );

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
