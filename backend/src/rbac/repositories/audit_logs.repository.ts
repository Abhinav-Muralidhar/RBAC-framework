import { Pool, QueryResultRow } from 'pg';
import { AuditLogs, AuditAction, AuditStatus } from '../models/audit_logs.model';
import { AuditLogResponseDto } from '../dto/audit-log.dto';

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
  create(entry: Partial<AuditLogs>): Promise<AuditLogs>;
  findById(id: string): Promise<AuditLogs | null>;
  findByIdWithDetails(id: string): Promise<AuditLogResponseDto | null>;
  findByUser(userId: string, limit?: number, offset?: number): Promise<AuditLogs[]>;
  findByEntity(entityType: string, entityId: string, limit?: number, offset?: number): Promise<AuditLogs[]>;
  findByAction(action: AuditAction, limit?: number, offset?: number): Promise<AuditLogs[]>;
  findByDateRange(startDate: Date, endDate: Date, limit?: number, offset?: number): Promise<AuditLogs[]>;
  findAll(limit?: number, offset?: number): Promise<AuditLogs[]>;
  findAllWithDetails(limit?: number, offset?: number): Promise<AuditLogResponseDto[]>;
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
  async findByIdWithDetails(id: string): Promise<AuditLogResponseDto | null> {
    const res = await this.query<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       WHERE al.id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByUser(userId: string, limit: number = 50, offset: number = 0): Promise<AuditLogs[]> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.rows;
  }

  async findByEntity(entityType: string, entityId: string, limit: number = 50, offset: number = 0): Promise<AuditLogs[]> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, limit, offset]
    );
    return res.rows;
  }

  async findByAction(action: AuditAction, limit: number = 50, offset: number = 0): Promise<AuditLogs[]> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE action = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [action, limit, offset]
    );
    return res.rows;
  }

  async findByDateRange(startDate: Date, endDate: Date, limit: number = 50, offset: number = 0): Promise<AuditLogs[]> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       WHERE created_at BETWEEN $1 AND $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [startDate, endDate, limit, offset]
    );
    return res.rows;
  }

  async findAll(limit: number = 50, offset: number = 0): Promise<AuditLogs[]> {
    const res = await this.query<AuditLogs>(
      `SELECT * FROM ${this.tableName}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  /**
   * Find all audit logs with JOINed user, role, and module data
   * Returns human-readable names alongside IDs
   */
  async findAllWithDetails(limit: number = 50, offset: number = 0): Promise<AuditLogResponseDto[]> {
    const res = await this.query<AuditLogWithDetailsRow>(
      `${this.selectWithJoinsQuery}
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  async create(entry: Partial<AuditLogs>): Promise<AuditLogs> {
    const keys = Object.keys(entry);
    const values = Object.values(entry);

    if (keys.length === 0) throw new Error('Cannot create audit log with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<AuditLogs>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
  }
}

