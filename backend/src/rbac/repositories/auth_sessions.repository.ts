import { Pool, QueryResultRow } from 'pg';
import { AuthSessions } from '../models/auth_sessions.model';

export interface IAuthSessionsRepository {
  create(data: Partial<AuthSessions>): Promise<AuthSessions>;
  findById(sessionId: string): Promise<AuthSessions | null>;
  update(sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions>;
  delete(sessionId: string, actingUserId: string): Promise<void>;
  findAllByUser(userId: string): Promise<AuthSessions[]>;
  findActiveByUser(userId: string): Promise<AuthSessions[]>;
  deleteAllByUser(userId: string): Promise<void>;
  findBySessionIdGlobal(sessionId: string): Promise<AuthSessions | null>;
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

  async findAllByUser(userId: string): Promise<AuthSessions[]> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async findActiveByUser(userId: string): Promise<AuthSessions[]> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1 AND logout_at IS NULL`,
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

  async findBySessionIdGlobal(sessionId: string): Promise<AuthSessions | null> {
    const res = await this.query<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return res.rows[0] ?? null;
  }

  async create(data: Partial<AuthSessions>): Promise<AuthSessions> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) throw new Error('Cannot create session with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<AuthSessions>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
  }

  async update(sessionId: string, data: Partial<AuthSessions>): Promise<AuthSessions> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(sessionId);
      if (!existing) throw new Error(`Session ${sessionId} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');

    const res = await this.query<AuthSessions>(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [sessionId, ...values]
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
