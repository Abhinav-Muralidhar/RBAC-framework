import { IDatabase } from 'pg-promise';
import { TransactionTask } from '../utils/transaction.utils';
import { SmtpConfig } from '../models/smtp_config.model';
import { CreateSmtpConfigInput } from '../types/repository.types';
import { buildPaginatedResult, getPaginationOffset, normalizePaginationParams, PaginatedResult, PaginationParams } from '../utils/pagination.utils';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface ISmtpConfigRepository {
  create(t: TransactionTask, input: CreateSmtpConfigInput): Promise<SmtpConfig>;
  update(t: TransactionTask, id: string, input: SmtpConfig): Promise<SmtpConfig>;
  findById(t: TransactionTask, id: string): Promise<SmtpConfig | null>;
  findAll(t: TransactionTask, filters?: { isActive?: boolean }, paginationParams?: PaginationParams): Promise<PaginatedResult<SmtpConfig>>;
  delete(t: TransactionTask, id: string): Promise<void>;
}

export class SmtpConfigRepository implements ISmtpConfigRepository {
  private tableName = 'smtp_config';

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
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
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
      `SELECT *
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
       (name, host, port, username, password, encryption, from_email, from_name, is_active, reply_to_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false), $10)
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
        input.reply_to_email ?? null
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
           version = version + 1
       WHERE id = $11 AND version = $12
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
