import { IDatabase, ITask } from 'pg-promise';
import { Organizations } from '../models/organizations.model';
import {
    PaginationParams,
    PaginatedResult,
    normalizePaginationParams,
    getPaginationOffset,
    buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateOrganizationInput } from '../types/repository.types';
import { TransactionTask } from '../utils/transaction.utils';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface IOrganizationRepository {
    getById(t: TransactionTask | undefined, id: string): Promise<Organizations | null>;
    update(t: TransactionTask | undefined, input: Organizations): Promise<Organizations>;
    delete(t: TransactionTask | undefined, id: string): Promise<void>;
    getAll(
        t: TransactionTask | undefined,
        filters?: { is_active?: boolean; name?: string; code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Organizations>>;
    activate(t: TransactionTask | undefined, id: string): Promise<void>;
    create(t: TransactionTask | undefined, input: CreateOrganizationInput): Promise<Organizations>;
    updateLogo(t: TransactionTask | undefined, id: string, logoPath: string): Promise<void>;
}

export class OrganizationRepository implements IOrganizationRepository {
    private tableName = 'organizations';

    constructor(private db: IDatabase<unknown>) { }

    protected async query<T>(
        text: string,
        params?: unknown[],
        t?: TransactionTask
    ): Promise<T[]> {
        return (t ?? this.db).any<T>(text, params);
    }

    async create(t: TransactionTask | undefined, input: CreateOrganizationInput): Promise<Organizations> {
        const row = await (t ?? this.db).oneOrNone<Organizations>(
            `INSERT INTO ${this.tableName}
         (company_name, company_logo, address, city, state, postal_code, country, country_code, phone, fax, website, facebook, twitter, linkedin, financial_year_start_month, gstin, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
            [
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
                input.created_by
            ]
        );

        if (!row) {
            throw new Error('Organization not found or create failed');
        }

        return row;
    }

    async getById(
        t: TransactionTask | undefined,
        id: string
    ): Promise<Organizations | null> {
        const rows = await this.query<Organizations>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id],
            t
        );
        return rows[0] ?? null;
    }

    async getAll(
        t: TransactionTask | undefined,
        filters?: { is_active?: boolean; name?: string; code?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Organizations>> {
        const p = normalizePaginationParams(pagination);
        const offset = getPaginationOffset(p.page, p.limit);

        const params: unknown[] = [];
        const where: string[] = [];

        params.push(filters?.is_active ?? true);
        where.push(`is_active = $${params.length}`);

        if (filters?.name) {
            params.push(`%${filters.name}%`);
            where.push(`name ILIKE $${params.length}`);
        }

        if (filters?.code) {
            params.push(`%${filters.code}%`);
            where.push(`code ILIKE $${params.length}`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const totalRes = await this.query<{ count: string }>(
            `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
            params,
            t
        );

        params.push(p.limit, offset);

        const res = await this.query<Organizations>(
            `SELECT *
             FROM ${this.tableName}
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length - 1}
             OFFSET $${params.length}`,
            params,
            t
        );

        return buildPaginatedResult(
            res,
            parseInt(totalRes[0]?.count ?? '0', 10),
            p
        );
    }

    async update(
        t: TransactionTask | undefined,
        input: Organizations
    ): Promise<Organizations> {
        const row = await (t ?? this.db).oneOrNone<Organizations>(
            `UPDATE ${this.tableName}
             SET company_name = $1,
                 company_logo = $2,
                 address = $3,
                 city = $4,
                 state = $5,
                 postal_code = $6,
                 country = $7,
                 country_code = $8,
                 phone = $9,
                 fax = $10,
                 website = $11,
                 facebook = $12,
                 twitter = $13,
                 linkedin = $14,
                 financial_year_start_month = $15,
                 gstin = $16,
                 is_active = $17,
                 updated_at = NOW(),
                 version = version + 1
             WHERE id = $18 AND version = $19
             RETURNING *`,
            [
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
                input.id,
                input.version
            ]
        );

        if (!row) {
            throw new ConcurrentModificationError('Organization', input.id);
        }

        return row;
    }

    async delete(t: TransactionTask | undefined, id: string): Promise<void> {
        await (t ?? this.db).none(
            `UPDATE ${this.tableName}
             SET is_active = false, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }

    async activate(t: TransactionTask | undefined, id: string): Promise<void> {
        await (t ?? this.db).none(
            `UPDATE ${this.tableName}
             SET is_active = true, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }

    async updateLogo(t: TransactionTask | undefined, id: string, logoPath: string): Promise<void> {
        await (t ?? this.db).none(
            `UPDATE ${this.tableName}
             SET company_logo = $1, updated_at = NOW()
             WHERE id = $2`,
            [logoPath, id]
        );
    }
}
