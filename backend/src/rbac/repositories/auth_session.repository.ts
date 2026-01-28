import { Pool, QueryResultRow } from 'pg';
import { AuthSession } from '../models/auth_session.model';

export interface IAuthSessionRepository {
  create(data: Partial<AuthSession>): Promise<AuthSession>;
  findById(sessionId: string): Promise<AuthSession | null>;
  update(sessionId: string, data: Partial<AuthSession>): Promise<AuthSession>;
  delete(sessionId: string, actingUserId: string): Promise<void>;
  findAllByUser(userId: string): Promise<AuthSession[]>;
  findActiveByUser(userId: string): Promise<AuthSession[]>;
  deleteAllByUser(userId: string): Promise<void>;
  findBySessionIdGlobal(sessionId: string): Promise<AuthSession | null>;
}

export class AuthSessionRepository implements IAuthSessionRepository {
  private tableName = 'auth_sessions';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const res = await this.query<AuthSession>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return res.rows[0] ?? null;
  }

  async findAllByUser(userId: string): Promise<AuthSession[]> {
    const res = await this.query<AuthSession>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async findActiveByUser(userId: string): Promise<AuthSession[]> {
    const res = await this.query<AuthSession>(
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

  async findBySessionIdGlobal(sessionId: string): Promise<AuthSession | null> {
    const res = await this.query<AuthSession>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return res.rows[0] ?? null;
  }

  async create(data: Partial<AuthSession>): Promise<AuthSession> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) throw new Error('Cannot create session with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<AuthSession>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
  }

  async update(sessionId: string, data: Partial<AuthSession>): Promise<AuthSession> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(sessionId);
      if (!existing) throw new Error(`Session ${sessionId} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');

    const res = await this.query<AuthSession>(
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
