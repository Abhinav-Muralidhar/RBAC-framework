import { IDatabase, ITask } from 'pg-promise';
import { AuthSessions, AuthSessionWithUsername } from '../models/auth_sessions.model';
import { CreateAuthSessionInput } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../../utils/pagination.utils';

export type TransactionTask = ITask<unknown>;

export interface IAuthSessionsRepository {
  /** Insert a new authentication session row. */
  create(t: TransactionTask | undefined, data: CreateAuthSessionInput): Promise<AuthSessions>;
  /** Fetch a session by its primary ID. */
  findById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions | null>;
  /** Fetch a session by its unique token. */
  findBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null>;
  /** Fetch a valid active session by token in one query. */
  findValidBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null>;
  /** Update session details (e.g. extension, logout timestamp). */
  update(t: TransactionTask | undefined, sessionId: string, data: AuthSessions): Promise<AuthSessions>;
  /** Hard-delete a session. */
  delete(t: TransactionTask | undefined, sessionId: string): Promise<void>;
  /** List all sessions (active and inactive) for a specific user with pagination. */
  findAllByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>>;
  /** List only non-expired, non-logged-out sessions for a user with pagination. */
  findActiveByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>>;
  /** Count active sessions for a user. */
  countActiveByUser(t: TransactionTask | undefined, userId: string): Promise<number>;
  /** Revoke/delete all sessions for a specific user. */
  deleteAllByUser(t: TransactionTask | undefined, userId: string): Promise<void>;
  /** List sessions system-wide with optional user/active/search filters and pagination. */
  findAll(t: TransactionTask | undefined, filters?: { userId?: string; isActive?: boolean; search?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessionWithUsername>>;
  /** Batch delete sessions that have passed their expiration time. */
  deleteExpired(t: TransactionTask | undefined): Promise<void>;
  /** Revoke a specific session for a user. */
  deleteOneForUser(t: TransactionTask | undefined, sessionId: string, userId: string, actingUserId: string): Promise<void>;
}

export class AuthSessionsRepository implements IAuthSessionsRepository {
  private tableName = 'auth_sessions';
  private readonly baseColumns = 'id, user_id, session_token, expires_at, ip_address, user_agent, login_at, logout_at';

  constructor(private db: IDatabase<unknown>) { }

  private getTask(t?: TransactionTask) {
    return t ?? this.db;
  }

  async findById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions | null> {
    const rows = await this.getTask(t).any<AuthSessions>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return rows[0] ?? null;
  }

  async findBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null> {
    const rows = await this.getTask(t).any<AuthSessions>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE session_token = $1`,
      [sessionToken]
    );
    return rows[0] ?? null;
  }

  async findValidBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null> {
    return this.getTask(t).oneOrNone<AuthSessions>(
      `SELECT ${this.baseColumns}
       FROM ${this.tableName}
       WHERE session_token = $1
         AND logout_at IS NULL
         AND expires_at > NOW()`,
      [sessionToken]
    );
  }

  async create(t: TransactionTask | undefined, data: CreateAuthSessionInput): Promise<AuthSessions> {
    const row = await this.getTask(t).one<AuthSessions>(
      `INSERT INTO ${this.tableName} (user_id, session_token, ip_address, user_agent, login_at, expires_at, logout_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.user_id,
        data.session_token,
        data.ip_address,
        data.user_agent,
        data.login_at,
        data.expires_at,
        data.logout_at
      ]
    );

    if (!row) {
      throw new Error('Session creation failed');
    }
    return row;
  }

  async update(t: TransactionTask | undefined, sessionId: string, data: AuthSessions): Promise<AuthSessions> {
    const row = await this.getTask(t).one<AuthSessions>(
      `UPDATE ${this.tableName}
       SET expires_at = $1, logout_at = $2
       WHERE id = $3
       RETURNING *`,
      [data.expires_at, data.logout_at, sessionId]
    );

    if (!row) throw new Error(`Session ${sessionId} not found for update`);
    return row;
  }

  async delete(t: TransactionTask | undefined, sessionId: string): Promise<void> {
    await this.getTask(t).none(
      `UPDATE ${this.tableName} 
       SET logout_at = NOW(), expires_at = NOW() 
       WHERE id = $1`,
      [sessionId]
    );
  }

  async deleteOneForUser(t: TransactionTask | undefined, sessionId: string, userId: string, actingUserId: string): Promise<void> {
    await this.getTask(t).none(
      `UPDATE ${this.tableName} 
       SET logout_at = NOW(), expires_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
  }

  async deleteAllByUser(t: TransactionTask | undefined, userId: string): Promise<void> {
    await this.getTask(t).none(
      `UPDATE ${this.tableName} 
       SET logout_at = NOW(), expires_at = NOW() 
       WHERE user_id = $1`,
      [userId]
    );
  }

  async deleteExpired(t: TransactionTask | undefined): Promise<void> {
    await this.getTask(t).none(
      `UPDATE ${this.tableName} 
       SET logout_at = NOW(), expires_at = NOW() 
       WHERE expires_at < NOW() AND logout_at IS NULL`
    );
  }

  async findAllByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const task = this.getTask(t);

    const totalRes = await task.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );

    const rows = await task.any<AuthSessions>(
      `SELECT ${this.baseColumns} FROM ${this.tableName}
       WHERE user_id = $1
       ORDER BY login_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, p.limit, offset]
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }

  async findActiveByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const task = this.getTask(t);

    const totalRes = await task.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
       WHERE user_id = $1
         AND logout_at IS NULL
         AND expires_at > NOW()`,
      [userId]
    );

    const rows = await task.any<AuthSessions>(
      `SELECT ${this.baseColumns} FROM ${this.tableName}
       WHERE user_id = $1
         AND logout_at IS NULL
         AND expires_at > NOW()
       ORDER BY login_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, p.limit, offset]
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }

  async countActiveByUser(t: TransactionTask | undefined, userId: string): Promise<number> {
    const result = await this.getTask(t).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
       WHERE user_id = $1
         AND logout_at IS NULL
         AND expires_at > NOW()`,
      [userId]
    );

    return parseInt(result.count ?? '0', 10);
  }

  async findAll(
    t: TransactionTask | undefined,
    filters?: { userId?: string; isActive?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<AuthSessionWithUsername>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const task = this.getTask(t);

    // Build WHERE clause with filters
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (filters?.userId) {
      params.push(filters.userId);
      whereClauses.push(`s.user_id = $${params.length}`);
    }

    if (filters?.isActive === true) {
      whereClauses.push(`s.logout_at IS NULL AND s.expires_at > NOW()`);
    } else if (filters?.isActive === false) {
      whereClauses.push(`(s.logout_at IS NOT NULL OR s.expires_at <= NOW())`);
    }

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      whereClauses.push(`(u.username ILIKE $${params.length} OR s.ip_address ILIKE $${params.length})`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total with filters
    const totalRes = await task.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} s
       LEFT JOIN users u ON s.user_id = u.id
       ${whereClause}`,
      params
    );

    // Add pagination params
    params.push(p.limit, offset);

    // Fetch with filters and pagination
    const rows = await task.any<AuthSessionWithUsername>(
      `SELECT s.id, s.user_id, s.expires_at, s.ip_address, s.user_agent, s.login_at, s.logout_at, u.username FROM ${this.tableName} s
       LEFT JOIN users u ON s.user_id = u.id
       ${whereClause}
       ORDER BY s.login_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }
}
