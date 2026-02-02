import { Pool, QueryResultRow } from 'pg';
import { AuthSessions } from '../models/auth_sessions.model';
import { CreateAuthSessionInput } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export interface IAuthSessionsRepository {
  create(data: CreateAuthSessionInput): Promise<AuthSessions>;
  findById(sessionId: string): Promise<AuthSessions | null>;
  findBySessionToken(sessionToken: string): Promise<AuthSessions | null>;
  update(sessionId: string, data: AuthSessions): Promise<AuthSessions>;
  delete(sessionId: string, actingUserId: string): Promise<void>;
  findAllByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>>;
  findActiveByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>>;
  deleteAllByUser(userId: string): Promise<void>;
  findAll(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>>;
  deleteExpired(): Promise<void>;
}

export class AuthSessionsRepository implements IAuthSessionsRepository {
  private tableName = 'auth_sessions';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(sessionId: string): Promise<AuthSessions | null> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return res.rows[0] ?? null;
  }

  async deleteExpired(): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET logout_at = NOW(), expires_at = NOW() WHERE expires_at < NOW() AND logout_at IS NULL`
    );
  }

  /**
   * Find session by session_token (used for authentication).
   * This is the primary lookup method for middleware.
   */
  async findBySessionToken(sessionToken: string): Promise<AuthSessions | null> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE session_token = $1`,
      [sessionToken]
    );
    return res.rows[0] ?? null;
  }

  async findAllByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    const res = await this.query<AuthSessions[]>(
      `SELECT * FROM ${this.tableName}
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, p.limit, offset]
    );
    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

  async findActiveByUser(userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
       WHERE user_id = $1
         AND logout_at IS NULL
         AND expires_at > NOW()`,
      [userId]
    );
    const res = await this.query<AuthSessions[]>(
      `SELECT * FROM ${this.tableName}
       WHERE user_id = $1
         AND logout_at IS NULL
         AND expires_at > NOW()
       ORDER BY login_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, p.limit, offset]
    );
    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }
  async deleteAllByUser(userId: string): Promise<void> {
    await this.query(
      `Update ${this.tableName} set logout_at = NOW(), expires_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  }

  async create(data: CreateAuthSessionInput): Promise<AuthSessions> {
    const res = await this.query<AuthSessions>(
      `INSERT INTO ${this.tableName} (user_id, session_token, ip_address, user_agent, login_at, expires_at, logout_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.user_id, data.session_token, data.ip_address, data.user_agent, data.login_at, data.expires_at, data.logout_at]
    );

    if (!res.rows[0]) {
      throw new Error('Session creation failed');
    }
    return res.rows[0];
  }

  async update(sessionId: string, data: AuthSessions): Promise<AuthSessions> {
    const res = await this.query<AuthSessions>(
      `UPDATE ${this.tableName}
       SET expires_at = $1, logout_at = $2
       WHERE id = $3
       RETURNING *`,
      [data.expires_at, data.logout_at, sessionId]
    );

    if (res.rows.length === 0) throw new Error(`Session ${sessionId} not found for update`);
    return res.rows[0]!;
  }

  async delete(sessionId: string, actingUserId: string): Promise<void> {
    await this.query(
      `Update ${this.tableName} set logout_at = NOW(), expires_at = NOW() where id = $1 and user_id = $2`,
      [sessionId, actingUserId]
    );
  }

  async findAll(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions[]>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const totalRes = await this.query<{ count: string }>(`SELECT COUNT(*) FROM ${this.tableName}`);
    const res = await this.query<AuthSessions[]>(
      `SELECT * FROM ${this.tableName}
       ORDER BY login_at DESC
       LIMIT $1 OFFSET $2`,
      [p.limit, offset]
    );
    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }
}
