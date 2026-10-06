import { IDatabase } from 'pg-promise';
import { Organizations } from '../models/organizations.model';
import {
    PaginationParams,
    PaginatedResult,
    normalizePaginationParams,
    getPaginationOffset,
    buildPaginatedResult
} from '../../utils/pagination.utils';
import { CreateOrganizationInput } from '../types/repository.types';
import { TransactionTask } from '../../utils/transaction.utils';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface IOrganizationRepository {
    /** Fetch an organization by its primary key. */
    getById(t: TransactionTask | undefined, id: string): Promise<Organizations | null>;
    /** Fetch organization with JOINed creator and updater names. */
    getByIdWithDetails(t: TransactionTask | undefined, id: string): Promise<(Organizations & { created_by_name: string | null; updated_by_name: string | null }) | null>;
    /** Update organization attributes with optimistic concurrency (version check). */
    update(t: TransactionTask | undefined, input: Organizations): Promise<Organizations>;
    /** Hard-delete an organization. */
    delete(t: TransactionTask | undefined, id: string): Promise<void>;
    /** List all organizations with optional active/name filters and pagination. */
    getAll(
        t: TransactionTask | undefined,
        filters?: { is_active?: boolean; name?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Organizations>>;
    /** Set an organization's status to active. */
    activate(t: TransactionTask | undefined, id: string): Promise<void>;
    /** Insert a new organization row. */
    create(t: TransactionTask | undefined, input: CreateOrganizationInput): Promise<Organizations>;
}

export class OrganizationRepository implements IOrganizationRepository {
    private tableName = 'organizations';
    private readonly selectColumns = 'o.id, o.version, o.company_name, o.company_logo, o.address, o.city, o.state, o.postal_code, o.country, o.country_code, o.phone, o.fax, o.website, o.facebook, o.twitter, o.linkedin, o.financial_year_start_month, o.gstin, o.is_active, o.created_at, o.created_by, o.updated_at, o.updated_by';

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
         (company_name, company_logo, address, city, state, postal_code, country, country_code, phone, fax, website, facebook, twitter, linkedin, financial_year_start_month, gstin, is_active, created_by, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
         RETURNING *`,
            [
                input.company_name,
                input.company_logo ?? '',
                input.address ?? '',
                input.city ?? '',
                input.state ?? '',
                input.postal_code ?? '',
                input.country ?? '',
                input.country_code ?? '',
                input.phone ?? null,
                input.fax ?? null,
                input.website ?? null,
                input.facebook ?? null,
                input.twitter ?? null,
                input.linkedin ?? null,
                input.financial_year_start_month ?? null,
                input.gstin ?? '',
                input.is_active ?? true,
                input.created_by ?? null,
                input.created_by ?? null
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
            `SELECT ${this.selectColumns}
             FROM ${this.tableName} o
             WHERE o.id = $1`,
            [id],
            t
        );
        return rows[0] ?? null;
    }

    async getByIdWithDetails(
        t: TransactionTask | undefined,
        id: string
    ): Promise<(Organizations & { created_by_name: string | null; updated_by_name: string | null }) | null> {
        const rows = await this.query<Organizations & { created_by_name: string | null; updated_by_name: string | null }>(
            `SELECT ${this.selectColumns},
               CASE
                 WHEN c.id IS NOT NULL THEN c.username
                 ELSE NULL
               END AS created_by_name,
               CASE
                 WHEN ub.id IS NOT NULL THEN ub.username
                 ELSE NULL
               END AS updated_by_name
             FROM ${this.tableName} o
             LEFT JOIN users c ON o.created_by = c.id
             LEFT JOIN users ub ON o.updated_by = ub.id
             WHERE o.id = $1`,
            [id],
            t
        );
        return rows[0] ?? null;
    }

    async getAll(
        t: TransactionTask | undefined,
        filters?: { is_active?: boolean; name?: string },
        pagination?: Partial<PaginationParams>
    ): Promise<PaginatedResult<Organizations>> {
        const p = normalizePaginationParams(pagination);
        const offset = getPaginationOffset(p.page, p.limit);

        const params: unknown[] = [];
        const where: string[] = [];

        params.push(filters?.is_active ?? true);
        where.push(`o.is_active = $${params.length}`);

        if (filters?.name) {
            params.push(`%${filters.name}%`);
            where.push(`o.company_name ILIKE $${params.length}`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const totalRes = await this.query<{ count: string }>(
            `SELECT COUNT(*) FROM ${this.tableName} o ${whereClause}`,
            params,
            t
        );

        params.push(p.limit, offset);

        const res = await this.query<Organizations>(
            `SELECT ${this.selectColumns}
             FROM ${this.tableName} o
             ${whereClause}
             ORDER BY o.created_at DESC
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
                 updated_by = $18,
                 version = version + 1
             WHERE id = $19 AND version = $20
             RETURNING *`,
            [
                input.company_name,
                input.company_logo ?? '',
                input.address,
                input.city,
                input.state,
                input.postal_code,
                input.country,
                input.country_code,
                input.phone ?? null,
                input.fax ?? null,
                input.website ?? null,
                input.facebook ?? null,
                input.twitter ?? null,
                input.linkedin ?? null,
                input.financial_year_start_month ?? null,
                input.gstin,
                input.is_active,
                input.updated_by ?? null,
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
}
