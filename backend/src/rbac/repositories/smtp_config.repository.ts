import { Pool, QueryResultRow } from 'pg';
import { SmtpConfig } from '../models/smtp_config.model';
import { CreateSmtpConfigInput } from '../types/repository.types';

export interface ISmtpConfigRepository {
  create(input: CreateSmtpConfigInput): Promise<SmtpConfig>;
  update(id: string, input: SmtpConfig): Promise<SmtpConfig>;
  findById(id: string): Promise<SmtpConfig | null>;
  findAll(isActive?: boolean): Promise<SmtpConfig[]>;
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

  async findAll(isActive?: boolean): Promise<SmtpConfig[]> {
    const res = await this.query<SmtpConfig>(
      `SELECT * FROM ${this.tableName} WHERE is_active = $1`,
      [isActive]
    );
    return res.rows;
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

  async update(id: string, input: SmtpConfig): Promise<SmtpConfig> {
    const values = [
      input.name,
      input.host,
      input.port,
      input.username,
      input.password,
      input.encryption,
      input.from_email,
      input.from_name,
      input.is_active,
      input.reply_to_email,
      id
    ]
    const res = await this.query<SmtpConfig>(
      `UPDATE ${this.tableName}
       SET name = $1, host = $2, port = $3, username = $4, password = $5, encryption = $6, from_email = $7, from_name = $8, is_active = $9, reply_to_email = $10
       WHERE id = $11
       RETURNING *`,
      values
    );

    if (!res.rows[0]) throw new Error(`SmtpConfig ${id} not found`);
    return res.rows[0];
  }
}
