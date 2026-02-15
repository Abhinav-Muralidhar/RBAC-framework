/**
 * Audit Logs Repository (Encrypted at Rest)
 * 
 * All data is stored encrypted. No JOINs — name resolution happens in the service layer.
 * Repository deals ONLY with encrypted ciphertext.
 */

import { IDatabase, ITask } from 'pg-promise';
import {
  EncryptedAuditLogRow,
  encryptAuditLogForStorage,
} from '../utils/crypto.utils';
import { CreateAuditLogInput } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export type TransactionTask = ITask<unknown>;

export interface IAuditLogsRepository {
  create(t: TransactionTask | undefined, input: CreateAuditLogInput): Promise<EncryptedAuditLogRow>;
  findById(t: TransactionTask | undefined, id: string): Promise<EncryptedAuditLogRow | null>;
  findAll(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<EncryptedAuditLogRow>>;
}

export class AuditLogsRepository implements IAuditLogsRepository {
  private tableName = 'audit_logs';

  constructor(private db: IDatabase<unknown>) { }

  // Helper: use transaction if provided, otherwise main connection
  protected async query<T>(text: string, params?: unknown[], t?: TransactionTask): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findById(t: TransactionTask | undefined, id: string): Promise<EncryptedAuditLogRow | null> {
    const rows = await this.query<EncryptedAuditLogRow>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
      t
    );
    return rows[0] ?? null;
  }

  async findAll(
    t: TransactionTask | undefined,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<EncryptedAuditLogRow>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`
    );

    const rows = await this.query<EncryptedAuditLogRow>(
      `SELECT * FROM ${this.tableName} ORDER BY id DESC LIMIT $1 OFFSET $2`,
      [p.limit, offset],
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
    const encrypted = encryptAuditLogForStorage(input);

    const rows = await this.query<EncryptedAuditLogRow>(
      `INSERT INTO ${this.tableName} (
                user_id, role_id, action, module_id, entity_type, entity_id,
                old_values, new_values, ip_address, user_agent, status, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      ],
      t
    );

    if (!rows[0]) throw new Error('Audit log creation failed');
    return rows[0];
  }
}