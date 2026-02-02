import { Pool, QueryResultRow } from 'pg';
import { AuditLogs, AuditAction, AuditStatus } from '../models/audit_logs.model';
import { CreateAuditLogInput } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

/**
 * Raw row type from JOIN query
 */
interface AuditLogWithDetailsRow extends QueryResultRow {
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
  create(input: CreateAuditLogInput): Promise<AuditLogs>;
  findById(id: string): Promise<AuditLogs | null>;
  findByIdWithDetails(id: string): Promise<AuditLogWithDetailsRow | null>;
  findByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>>;
  findByEntity(entityType: string, entityId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>>;
  findByAction(action: AuditAction, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>>;
  findByDateRange(startDate: Date, endDate: Date, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>>;
  findAll(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>>;
  findAllWithDetails(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogWithDetailsRow>>;
}

export class AuditLogsRepository implements IAuditLogsRepository {
  private tableName = 'audit_logs';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
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

  async findById(id: string): Promise<AuditLogs | null> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find audit log by ID with JOINed user, role, and module data
   */
  async findByIdWithDetails(id: string): Promise<AuditLogWithDetailsRow | null> {
    const res = await this.query<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       WHERE al.id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );

    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findByEntity(entityType: string, entityId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId]
    );

    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findByAction(action: AuditAction, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE action = $1`,
      [action]
    );

    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE action = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [action, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findByDateRange(startDate: Date, endDate: Date, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
       WHERE created_at BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE created_at BETWEEN $1 AND $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [startDate, endDate, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findAll(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogs>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`
    );

    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findAllWithDetails(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuditLogWithDetailsRow>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`
    );

    const res = await this.query<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async create(input: CreateAuditLogInput): Promise<AuditLogs> {
    const res = await this.query<AuditLogs>(
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
    if (!res.rows[0]) throw new Error('Audit log creation failed');
    return res.rows[0];
  }
}
