import { Pool, QueryResultRow } from 'pg';
import { Organizations } from '../models/organizations.model';

export interface IOrganizationRepository {
    /** Fetch the single organization */
    get(): Promise<Organizations | null>;

    /** Update the organization details */
    update(input: Organizations): Promise<Organizations>;
    delete(id: string): Promise<void>;
}

export class OrganizationRepository implements IOrganizationRepository {
    private tableName = 'organizations';
    private orgId = '1';

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

    async update(input: Organizations): Promise<Organizations> {
        const values = [
            input.company_name,
            input.company_logo,
            input.address,
            input.city,
            input.state,
            input.postal_code,
            input.country,
            input.country_code,
            input.phone,
            input.fax,
            input.website,
            input.facebook,
            input.twitter,
            input.linkedin,
            input.financial_year_start_month,
            input.gstin,
            input.is_active,
            new Date(),
            this.orgId
        ];
        const res = await this.query<Organizations>(
            `UPDATE ${this.tableName} SET company_name = $1, company_logo = $2, address = $3, city = $4, state = $5, postal_code = $6, country = $7, country_code = $8, phone = $9, fax = $10, website = $11, facebook = $12, twitter = $13, linkedin = $14, financial_year_start_month = $15, gstin = $16, is_active = $17, updated_at = $18 WHERE id = $19 RETURNING *`,
            values
        );
        if (!res.rows[0]) throw new Error("Organization not found or update failed");
        return res.rows[0];
    }

    async delete(id: string): Promise<void> {
        await this.query(
            `UPDATE ${this.tableName} SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }
}
