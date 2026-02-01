import { Pool, QueryResultRow } from 'pg';
import { AuthSessions } from '../models/auth_sessions.model';

/**
 * Strict input type for creating a session.
 * DB auto-generates `id`, so it's not required here.
 */
export interface CreateAuthSessionInput {
  user_id: string;
  session_token: string;
  ip_address: string;
  user_agent: string;
  login_at: Date;
  expires_at: Date;
  logout_at: Date | null;
}

/**
 * Strict input type for updating a session.
 * Only these fields can be updated.
 */
export interface UpdateAuthSessionInput {
  expires_at?: Date;
  logout_at?: Date | null;
}

export interface IAuthSessionsRepository {
  create(data: CreateAuthSessionInput): Promise<AuthSessions>;
  findById(sessionId: string): Promise<AuthSessions | null>;
  findBySessionToken(sessionToken: string): Promise<AuthSessions | null>;
  update(sessionId: string, data: UpdateAuthSessionInput): Promise<AuthSessions>;
  delete(sessionId: string, actingUserId: string): Promise<void>;
  findAllByUser(userId: string): Promise<AuthSessions[]>;
  findActiveByUser(userId: string): Promise<AuthSessions[]>;
  deleteAllByUser(userId: string): Promise<void>;
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

  async findAllByUser(userId: string): Promise<AuthSessions[]> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async findActiveByUser(userId: string): Promise<AuthSessions[]> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1 AND logout_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return res.rows;
  }

  async deleteAllByUser(userId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE user_id = $1`,
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

  async update(sessionId: string, data: UpdateAuthSessionInput): Promise<AuthSessions> {
    const updates: string[] = [];
    const values: unknown[] = [sessionId];
    let paramIndex = 2;

    if (data.expires_at !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(data.expires_at);
    }
    if (data.logout_at !== undefined) {
      updates.push(`logout_at = $${paramIndex++}`);
      values.push(data.logout_at);
    }

    if (updates.length === 0) {
      const existing = await this.findById(sessionId);
      if (!existing) throw new Error(`Session ${sessionId} not found`);
      return existing;
    }

    const res = await this.query<AuthSessions>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );

    if (res.rows.length === 0) throw new Error(`Session ${sessionId} not found for update`);
    return res.rows[0]!;
  }

  async delete(sessionId: string, actingUserId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 AND user_id = $2`,
      [sessionId, actingUserId]
    );
  }
}
