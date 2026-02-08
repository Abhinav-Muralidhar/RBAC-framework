import { IDatabase, ITask } from 'pg-promise';
import { AuthSessions } from '../models/auth_sessions.model';
import { CreateAuthSessionInput } from '../types/repository.types';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export type TransactionTask = ITask<unknown>;

export interface IAuthSessionsRepository {
  create(t: TransactionTask | undefined, data: CreateAuthSessionInput): Promise<AuthSessions>;
  findById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions | null>;
  findBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null>;
  update(t: TransactionTask | undefined, sessionId: string, data: AuthSessions): Promise<AuthSessions>;
  delete(t: TransactionTask | undefined, sessionId: string, actingUserId: string): Promise<void>;
  findAllByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>>;
  findActiveByUser(t: TransactionTask | undefined, userId: string, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>>;
  deleteAllByUser(t: TransactionTask | undefined, userId: string): Promise<void>;
  findAll(t: TransactionTask | undefined, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>>;
  deleteExpired(t: TransactionTask | undefined): Promise<void>;
  deleteOneForUser(t: TransactionTask | undefined, sessionId: string, userId: string, actingUserId: string): Promise<void>;
}

export class AuthSessionsRepository implements IAuthSessionsRepository {
  private tableName = 'auth_sessions';

  constructor(private db: IDatabase<unknown>) { }

  private getTask(t?: TransactionTask) {
    return t ?? this.db;
  }

  async findById(t: TransactionTask | undefined, sessionId: string): Promise<AuthSessions | null> {
    const rows = await this.getTask(t).any<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [sessionId]
    );
    return rows[0] ?? null;
  }

  async findBySessionToken(t: TransactionTask | undefined, sessionToken: string): Promise<AuthSessions | null> {
    const rows = await this.getTask(t).any<AuthSessions>(
      `SELECT * FROM ${this.tableName} WHERE session_token = $1`,
      [sessionToken]
    );
    return rows[0] ?? null;
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

  async delete(t: TransactionTask | undefined, sessionId: string, actingUserId: string): Promise<void> {
    await this.getTask(t).none(
      `UPDATE ${this.tableName} 
       SET logout_at = NOW(), expires_at = NOW() 
       WHERE id = $1`,
      [sessionId, actingUserId]
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
      `SELECT * FROM ${this.tableName}
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
      `SELECT * FROM ${this.tableName}
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

  async findAll(t: TransactionTask | undefined, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<AuthSessions>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const task = this.getTask(t);

    const totalRes = await task.one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`
    );

    const rows = await task.any<AuthSessions>(
      `SELECT * FROM ${this.tableName}
       ORDER BY login_at DESC
       LIMIT $1 OFFSET $2`,
      [p.limit, offset]
    );

    return buildPaginatedResult(
      rows,
      parseInt(totalRes.count ?? '0', 10),
      p
    );
  }
}