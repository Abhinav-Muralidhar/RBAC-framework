import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../../utils/transaction.utils';
import { SmtpConfig } from '../models/smtp_config.model';
import { CreateSmtpConfigInput } from '../types/repository.types';
import { buildPaginatedResult, getPaginationOffset, normalizePaginationParams, PaginatedResult, PaginationParams } from '../../utils/pagination.utils';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface ISmtpConfigRepository {
  /** Insert a new SMTP configuration row. */
  create(t: TransactionTask, input: CreateSmtpConfigInput): Promise<SmtpConfig>;
  /** Update an existing SMTP configuration row. */
  update(t: TransactionTask, id: string, input: SmtpConfig): Promise<SmtpConfig>;
  /** Fetch a single SMTP configuration by primary key. */
  findById(t: TransactionTask, id: string): Promise<SmtpConfig | null>;
  /** Fetch SMTP config with JOINed creator and updater names. */
  findByIdWithDetails(t: TransactionTask, id: string): Promise<(SmtpConfig & { created_by_name: string | null; updated_by_name: string | null }) | null>;
  /** List all SMTP configurations with optional active filter and pagination. */
  findAll(t: TransactionTask, filters?: { isActive?: boolean }, paginationParams?: PaginationParams): Promise<PaginatedResult<SmtpConfig>>;
  /** Hard-delete an SMTP configuration. */
  delete(t: TransactionTask, id: string): Promise<void>;
}

export class SmtpConfigRepository implements ISmtpConfigRepository {
  private tableName = 'smtp_config';
  private readonly baseColumns = 'id, version, name, host, port, username, password, encryption, from_email, from_name, reply_to_email, is_active, created_at, created_by, updated_at, updated_by';

  constructor(private db: IDatabase<unknown>) { }

  protected async query<T>(
    t: TransactionTask,
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    return t.any<T>(text, params);
  }

  async delete(t: TransactionTask, id: string): Promise<void> {
    await t.none(`UPDATE ${this.tableName} SET is_active = false WHERE id = $1`, [id]);
  }

  async findById(t: TransactionTask, id: string): Promise<SmtpConfig | null> {
    const res = await this.query<SmtpConfig>(
      t,
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res[0] ?? null;
  }

  async findByIdWithDetails(t: TransactionTask, id: string): Promise<(SmtpConfig & { created_by_name: string | null; updated_by_name: string | null }) | null> {
    const cols = this.baseColumns.split(', ').map(c => `s.${c}`).join(', ');
    const res = await this.query<SmtpConfig & { created_by_name: string | null; updated_by_name: string | null }>(
      t,
      `SELECT ${cols},
         CASE
           WHEN c.id IS NOT NULL THEN c.username
           ELSE NULL
         END AS created_by_name,
         CASE
           WHEN ub.id IS NOT NULL THEN ub.username
           ELSE NULL
         END AS updated_by_name
       FROM ${this.tableName} s
       LEFT JOIN users c ON s.created_by = c.id
       LEFT JOIN users ub ON s.updated_by = ub.id
       WHERE s.id = $1`,
      [id]
    );
    return res[0] ?? null;
  }

  async findAll(
    t: TransactionTask,
    filters?: { isActive?: boolean; search?: string },
    paginationParams?: PaginationParams
  ): Promise<PaginatedResult<SmtpConfig>> {
    const p = normalizePaginationParams(paginationParams);
    const offset = getPaginationOffset(p.page, p.limit);

    // Build WHERE clause and parameters
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      whereClauses.push(`is_active = $${params.length}`);
    }

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      whereClauses.push(`(name ILIKE $${params.length} OR host ILIKE $${params.length} OR from_email ILIKE $${params.length})`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total with filters
    const total = await t.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      params
    );

    // Add pagination params
    params.push(p.limit, offset);

    // Fetch items with filters and pagination
    const items = await t.any<SmtpConfig>(
      `SELECT ${this.baseColumns}
       FROM ${this.tableName} 
       ${whereClause}
       ORDER BY id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return buildPaginatedResult(items, parseInt(total.count, 10), p);
  }

  async create(t: TransactionTask, input: CreateSmtpConfigInput): Promise<SmtpConfig> {
    const res = await t.one<SmtpConfig>(
      `INSERT INTO ${this.tableName}
       (name, host, port, username, password, encryption, from_email, from_name, is_active, reply_to_email, created_by,updated_by,updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false), $10, $11,$12,NOW())
       RETURNING *`,
      [
        input.name,
        input.host,
        input.port,
        input.username,
        input.password,
        input.encryption,
        input.from_email,
        input.from_name,
        input.is_active ?? null,
        input.reply_to_email ?? null,
        input.created_by ?? null,
        input.created_by ?? null
      ]
    );

    return res;
  }

  async update(t: TransactionTask, id: string, input: SmtpConfig): Promise<SmtpConfig> {
    const res = await t.oneOrNone<SmtpConfig>(
      `UPDATE ${this.tableName}
       SET name = $1,
           host = $2,
           port = $3,
           username = $4,
           password = $5,
           encryption = $6,
           from_email = $7,
           from_name = $8,
           is_active = $9,
           reply_to_email = $10,
           updated_at = NOW(),
           updated_by = $11,
           version = version + 1
       WHERE id = $12 AND version = $13
       RETURNING *`,
      [
        input.name,
        input.host,
        input.port,
        input.username,
        input.password,
        input.encryption,
        input.from_email,
        input.from_name,
        input.is_active,
        input.reply_to_email,
        input.updated_by,
        id,
        input.version
      ]
    );

    if (!res) {
      throw new ConcurrentModificationError('SmtpConfig', id);
    }

    return res;
  }
}
