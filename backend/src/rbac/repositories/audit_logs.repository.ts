import { IDatabase, ITask } from 'pg-promise';
import { AuditLogs, AuditAction, AuditStatus } from '../models/audit_logs.model';
import { CreateAuditLogInput, AuditLogFilters } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export type TransactionTask = ITask<unknown>;

/**
 * Raw row type from JOIN query
 */
export interface AuditLogWithDetailsRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  role_id: string | null;
  role_name: string | null;
  action: AuditAction;
  module_id: string;
  module_name: string | null;
  module_code: string | null;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string;
  status: AuditStatus;
  created_at: Date;
}

export interface IAuditLogsRepository {
  create(t: TransactionTask | undefined, input: CreateAuditLogInput): Promise<AuditLogs>;
  findById(t: TransactionTask | undefined, id: string): Promise<AuditLogs | null>;
  findByIdWithDetails(t: TransactionTask | undefined, id: string): Promise<AuditLogWithDetailsRow | null>;
  findAllWithDetails(
    t: TransactionTask | undefined,
    filters?: AuditLogFilters,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<AuditLogWithDetailsRow>>;
}

export class AuditLogsRepository implements IAuditLogsRepository {
  private tableName = 'audit_logs';

  constructor(private db: IDatabase<unknown>) { }

  // Helper: use transaction if provided, otherwise main connection
  private getTask(t?: TransactionTask) {
    return t ?? this.db;
  }

  /**
   * Base JOIN query for fetching audit logs with related data
   */
  private get selectWithJoinsQuery(): string {
    return `
      SELECT 
        al.id,
        al.user_id,
        CASE 
          WHEN u.id IS NOT NULL THEN COALESCE(u.first_name, '') || ' ' || u.last_name
          ELSE NULL
        END AS user_name,
        u.primary_email AS user_email,
        al.role_id,
        r.name AS role_name,
        al.action,
        al.module_id,
        m.name AS module_name,
        m.code AS module_code,
        al.entity_type,
        al.entity_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.status,
        al.created_at
      FROM ${this.tableName} al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON al.role_id = r.id
      LEFT JOIN modules m ON al.module_id = m.id
    `;
  }

  async findById(t: TransactionTask | undefined, id: string): Promise<AuditLogs | null> {
    const rows = await this.getTask(t).any<AuditLogs>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async findByIdWithDetails(t: TransactionTask | undefined, id: string): Promise<AuditLogWithDetailsRow | null> {
    const rows = await this.getTask(t).any<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       WHERE al.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async findAllWithDetails(
    t: TransactionTask | undefined,
    filters?: AuditLogFilters,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<AuditLogWithDetailsRow>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters) {
      if (filters.user_id) {
        values.push(filters.user_id);
        conditions.push(`al.user_id = $${values.length}`);
      }

      if (filters.role_id) {
        values.push(filters.role_id);
        conditions.push(`al.role_id = $${values.length}`);
      }

      if (filters.action) {
        values.push(filters.action);
        conditions.push(`al.action = $${values.length}`);
      }

      if (filters.module_id) {
        values.push(filters.module_id);
        conditions.push(`al.module_id = $${values.length}`);
      }

      if (filters.entity_type) {
        values.push(filters.entity_type);
        conditions.push(`al.entity_type = $${values.length}`);
      }

      if (filters.status) {
        values.push(filters.status);
        conditions.push(`al.status = $${values.length}`);
      }

      if (filters.startDate && filters.endDate) {
        values.push(filters.startDate, filters.endDate);
        conditions.push(
          `al.created_at BETWEEN $${values.length - 1} AND $${values.length}`
        );
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const task = this.getTask(t);

    const totalRes = await task.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${where}`,
      values
    );

    const rows = await task.any<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [...values, p.limit, offset]
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }

  async create(t: TransactionTask | undefined, input: CreateAuditLogInput): Promise<AuditLogs> {
    const row = await this.getTask(t).one<AuditLogs>(
      `INSERT INTO ${this.tableName} (
        action, module_id, entity_type, entity_id, ip_address, user_agent, status,
        user_id, role_id, old_values, new_values
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        input.action,
        input.module_id,
        input.entity_type,
        input.entity_id,
        input.ip_address,
        input.user_agent,
        input.status,
        input.user_id ?? null,
        input.role_id ?? null,
        input.old_values ? JSON.stringify(input.old_values) : null,
        input.new_values ? JSON.stringify(input.new_values) : null
      ]
    );

    if (!row) throw new Error('Audit log creation failed');
    return row;
  }
}