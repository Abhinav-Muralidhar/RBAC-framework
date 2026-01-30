import { Pool, QueryResultRow } from 'pg';
import { OtpTokens } from '../models/otp_tokens.model';

export interface IOtpTokenRepository {
  create(otp: Partial<OtpTokens>): Promise<OtpTokens>;
  findLatestByUser(userId: string): Promise<OtpTokens | null>;
  incrementAttempts(userId: string): Promise<OtpTokens | null>;
  deleteExpired(): Promise<void>;
  deleteOnSuccess(userId: string, otpHash: string): Promise<boolean>;
}

export class OtpTokenRepository implements IOtpTokenRepository {
  private tableName = 'otp_tokens';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  /** Create a new OTP token entry */
  async create(otp: Partial<OtpTokens>): Promise<OtpTokens> {
    const keys = Object.keys(otp);
    const values = Object.values(otp);

    if (keys.length === 0) throw new Error('Cannot create empty OTP token');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<OtpTokens>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
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
