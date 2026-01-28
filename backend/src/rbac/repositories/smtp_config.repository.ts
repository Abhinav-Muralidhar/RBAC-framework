import { Pool, QueryResultRow } from 'pg';
import { SmtpConfig } from '../models/smtp_config.model';

export interface ISmtpConfigRepository {
  create(data: Partial<SmtpConfig>): Promise<SmtpConfig>;
  update(id: string, data: Partial<SmtpConfig>): Promise<SmtpConfig>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<SmtpConfig | null>;
  findAll(): Promise<SmtpConfig[]>;
  findActive(): Promise<SmtpConfig | null>;
}

export class SmtpConfigRepository implements ISmtpConfigRepository {
  private tableName = 'smtp_configs';

  constructor(private pool: InstanceType<typeof Pool>) {}

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

  async create(data: Partial<SmtpConfig>): Promise<SmtpConfig> {
    const keys = Object.keys(data);
    if (!keys.length) throw new Error("Cannot create empty SMTP config");
    const values = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<SmtpConfig>(
      `
      INSERT INTO ${this.tableName} (${cols})
      VALUES (${placeholders})
      RETURNING *
      `,
      values
    );

    return res.rows[0]!;
  }

  async update(id: string, data: Partial<SmtpConfig>): Promise<SmtpConfig> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`SmtpConfig ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<SmtpConfig>(
      `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
      `,
      [id, ...values]
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
