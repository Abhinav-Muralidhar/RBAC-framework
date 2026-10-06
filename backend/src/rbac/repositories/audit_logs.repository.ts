/**
 * Audit Logs Repository (Encrypted at Rest)
 * 
 * All data is stored encrypted. No JOINs — name resolution happens in the service layer.
 * Repository deals ONLY with encrypted ciphertext.
 */

import { IDatabase, ITask } from 'pg-promise';
import {
  encryptLogForStorage,
  computeLogHmac,
} from '../../utils/crypto.utils';
import { CreateAuditLogInput, EncryptedAuditLogListRow, EncryptedAuditLogRow } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../../utils/pagination.utils';

export type TransactionTask = ITask<unknown>;

export interface IAuditLogsRepository {
  /** Insert a new audit log entry with encrypted field values. */
  create(t: TransactionTask | undefined, input: CreateAuditLogInput): Promise<EncryptedAuditLogRow>;
  /** Fetch a specific encrypted audit log entry by its primary key. */
  findById(t: TransactionTask | undefined, id: string): Promise<EncryptedAuditLogRow | null>;
  /** List encrypted audit logs with optional HMAC filters for searchable fields and pagination. */
  findAll(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>,
    filters?: { hmac_entity_type?: string; hmac_action?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] }
  ): Promise<PaginatedResult<EncryptedAuditLogListRow>>;
  /** List full encrypted audit logs with pagination for export/detail use cases. */
  findAllDetailed(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>,
    filters?: { hmac_entity_type?: string; hmac_action?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] }
  ): Promise<PaginatedResult<EncryptedAuditLogRow>>;
}

export class AuditLogsRepository implements IAuditLogsRepository {
  private tableName = 'audit_logs';
  private readonly baseColumns = 'id, user_id, role_id, action, module_id, entity_type, entity_id, old_values, new_values, ip_address, user_agent, status, created_at, hmac_entity_type, hmac_action, hmac_user_id';

  constructor(private db: IDatabase<unknown>) { }

  // Helper: use transaction if provided, otherwise main connection
  protected async query<T>(text: string, params?: unknown[], t?: TransactionTask): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findById(t: TransactionTask | undefined, id: string): Promise<EncryptedAuditLogRow | null> {
    const rows = await this.query<EncryptedAuditLogRow>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
      [id],
      t
    );
    return rows[0] ?? null;
  }

  async findAll(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>,
    filters?: { hmac_entity_type?: string; hmac_action?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] }
  ): Promise<PaginatedResult<EncryptedAuditLogListRow>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const params: unknown[] = [];
    const whereClause = this.buildWhereClause(params, filters);

    const totalRes = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      params
    );

    params.push(p.limit, offset);
    const rows = await this.query<EncryptedAuditLogListRow>(
      `SELECT id, user_id, action, entity_type, entity_id, status, ip_address, created_at
       FROM ${this.tableName} ${whereClause} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      t
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }

  private buildWhereClause(params: unknown[], filters?: { hmac_entity_type?: string; hmac_action?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] }): string {
    const where: string[] = [];

    if (filters?.hmac_entity_type) {
      params.push(filters.hmac_entity_type);
      where.push(`hmac_entity_type = $${params.length}`);
    }

    if (filters?.hmac_action) {
      params.push(filters.hmac_action);
      where.push(`hmac_action = $${params.length}`);
    }

    if (filters?.hmac_user_id) {
      params.push(filters.hmac_user_id);
      where.push(`hmac_user_id = $${params.length}`);
    }

    const searchClauses: string[] = [];
    if (filters?.search_hmac) {
      params.push(filters.search_hmac);
      searchClauses.push(`hmac_entity_type = $${params.length}`);
      searchClauses.push(`hmac_action = $${params.length}`);
    }

    if (filters?.search_user_hmacs && filters.search_user_hmacs.length > 0) {
      params.push(filters.search_user_hmacs);
      searchClauses.push(`hmac_user_id = ANY($${params.length})`);
    }

    if (searchClauses.length > 0) {
      where.push(`(${searchClauses.join(' OR ')})`);
    }

    return where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  }

  async findAllDetailed(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>,
    filters?: { hmac_entity_type?: string; hmac_action?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] }
  ): Promise<PaginatedResult<EncryptedAuditLogRow>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const params: unknown[] = [];
    const whereClause = this.buildWhereClause(params, filters);

    const totalRes = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      params
    );

    params.push(p.limit, offset);
    const rows = await this.query<EncryptedAuditLogRow>(
      `SELECT ${this.baseColumns}
       FROM ${this.tableName} ${whereClause} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
      t
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }

  async create(t: TransactionTask | undefined, input: CreateAuditLogInput): Promise<EncryptedAuditLogRow> {
    // Encrypt all fields before persistence
    const encrypted = encryptLogForStorage(input);

    const rows = await this.query<EncryptedAuditLogRow>(
      `INSERT INTO ${this.tableName} (
                user_id, role_id, action, module_id, entity_type, entity_id,
                old_values, new_values, ip_address, user_agent, status, created_at, hmac_entity_type, hmac_action, hmac_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING *`,
      [
        encrypted.user_id,
        encrypted.role_id,
        encrypted.action,
        encrypted.module_id,
        encrypted.entity_type,
        encrypted.entity_id,
        encrypted.old_values,
        encrypted.new_values,
        encrypted.ip_address,
        encrypted.user_agent,
        encrypted.status,
        encrypted.created_at,
        encrypted.hmac_entity_type,
        encrypted.hmac_action,
        encrypted.hmac_user_id,
      ],
      t
    );

    if (!rows[0]) throw new Error('Audit log creation failed');
    return rows[0];
  }
}
