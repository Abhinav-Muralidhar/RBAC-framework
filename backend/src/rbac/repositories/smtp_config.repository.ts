import { Pool, QueryResultRow } from 'pg';
import { SmtpConfig } from '../models/smtp_config.model';
import { CreateSmtpConfigInput, UpdateSmtpConfigInput } from '../types/repository.types';

export interface ISmtpConfigRepository {
  create(input: CreateSmtpConfigInput): Promise<SmtpConfig>;
  update(id: string, input: UpdateSmtpConfigInput): Promise<SmtpConfig>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<SmtpConfig | null>;
  findAll(): Promise<SmtpConfig[]>;
  findActive(): Promise<SmtpConfig | null>;
}

export class SmtpConfigRepository implements ISmtpConfigRepository {
  private tableName = 'smtp_configs';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<SmtpConfig | null> {
    const res = await this.query<SmtpConfig>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<SmtpConfig[]> {
    const res = await this.query<SmtpConfig>(
      `SELECT * FROM ${this.tableName}`
    );
    return res.rows;
  }

  async findActive(): Promise<SmtpConfig | null> {
    const res = await this.query<SmtpConfig>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true LIMIT 1`
    );
    return res.rows[0] ?? null;
  }

  async create(input: CreateSmtpConfigInput): Promise<SmtpConfig> {
    const res = await this.query<SmtpConfig>(
      `INSERT INTO ${this.tableName} (name, host, port, username, password, encryption, from_email, from_name, is_active, reply_to_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, false), $10)
       RETURNING *`,
      [
        input.name,
        input.host,
        input.port,
        input.username,
        input.password,
        input.encryption,
        input.from_email,
        input.from_name,
        input.is_active ?? null,
        input.reply_to_email ?? null
      ]
    );
    if (!res.rows[0]) throw new Error('SMTP config creation failed');
    return res.rows[0];
  }

  async update(id: string, input: UpdateSmtpConfigInput): Promise<SmtpConfig> {
    const updates: string[] = [];
    const values: unknown[] = [id];
    let paramIdx = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(input.name);
    }
    if (input.host !== undefined) {
      updates.push(`host = $${paramIdx++}`);
      values.push(input.host);
    }
    if (input.port !== undefined) {
      updates.push(`port = $${paramIdx++}`);
      values.push(input.port);
    }
    if (input.username !== undefined) {
      updates.push(`username = $${paramIdx++}`);
      values.push(input.username);
    }
    if (input.password !== undefined) {
      updates.push(`password = $${paramIdx++}`);
      values.push(input.password);
    }
    if (input.encryption !== undefined) {
      updates.push(`encryption = $${paramIdx++}`);
      values.push(input.encryption);
    }
    if (input.from_email !== undefined) {
      updates.push(`from_email = $${paramIdx++}`);
      values.push(input.from_email);
    }
    if (input.from_name !== undefined) {
      updates.push(`from_name = $${paramIdx++}`);
      values.push(input.from_name);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.is_active);
    }
    if (input.reply_to_email !== undefined) {
      updates.push(`reply_to_email = $${paramIdx++}`);
      values.push(input.reply_to_email);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`SmtpConfig ${id} not found`);
      return existing;
    }

    const res = await this.query<SmtpConfig>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );

    if (!res.rows[0]) throw new Error(`SmtpConfig ${id} not found`);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }
}
