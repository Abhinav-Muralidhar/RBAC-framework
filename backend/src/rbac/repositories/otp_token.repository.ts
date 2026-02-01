import { Pool, QueryResultRow } from 'pg';
import { OtpTokens } from '../models/otp_tokens.model';
import { CreateOtpTokenInput } from '../types/repository.types';

export interface IOtpTokenRepository {
  create(input: CreateOtpTokenInput): Promise<OtpTokens>;
  findLatestByUser(userId: string): Promise<OtpTokens | null>;
  incrementAttempts(userId: string): Promise<OtpTokens | null>;
  deleteExpired(): Promise<void>;
  deleteOnSuccess(userId: string, otpHash: string): Promise<boolean>;
}

export class OtpTokenRepository implements IOtpTokenRepository {
  private tableName = 'otp_tokens';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  /** Create a new OTP token entry */
  async create(input: CreateOtpTokenInput): Promise<OtpTokens> {
    const res = await this.query<OtpTokens>(
      `INSERT INTO ${this.tableName} (user_id, otp_hash, expires_at, sent_to, ip_address, user_agent, attempt_count)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0))
       RETURNING *`,
      [
        input.user_id,
        input.otp_hash,
        input.expires_at,
        input.sent_to,
        input.ip_address,
        input.user_agent,
        input.attempt_count ?? null
      ]
    );
    if (!res.rows[0]) throw new Error('OTP token creation failed');
    return res.rows[0];
  }

  /** Get the latest valid OTP token for a user */
  async findLatestByUser(userId: string): Promise<OtpTokens | null> {
    const res = await this.query<OtpTokens>(
      `SELECT * FROM ${this.tableName}
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /** Increment attempts counter for the latest valid OTP token */
  async incrementAttempts(userId: string): Promise<OtpTokens | null> {
    const res = await this.query<OtpTokens>(
      `
      UPDATE ${this.tableName}
      SET attempt_count = attempt_count + 1
      WHERE id = (
        SELECT id FROM ${this.tableName}
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING *;
      `,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /** Delete all expired OTP tokens (on-demand cleanup) */
  async deleteExpired(): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE expires_at <= NOW()`
    );
  }

  /** Atomically validate OTP and delete if correct */
  async deleteOnSuccess(userId: string, otpHash: string): Promise<boolean> {
    const res = await this.query<OtpTokens>(
      `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1
        AND otp_hash = $2
        AND expires_at > NOW()
      RETURNING *;
      `,
      [userId, otpHash]
    );

    return res.rowCount! > 0; // true = OTP existed and deleted
  }
}
