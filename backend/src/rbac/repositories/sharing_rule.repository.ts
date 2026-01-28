import { Pool, QueryResultRow } from 'pg';
import { SharingRule } from '../models/sharing_rule.model';

export interface ISharingRuleRepository {
  create(data: Partial<SharingRule>): Promise<SharingRule>;
  update(id: string, data: Partial<SharingRule>): Promise<SharingRule>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<SharingRule | null>;
  findAll(): Promise<SharingRule[]>;
  findActive(): Promise<SharingRule[]>;
  findByType(type: string): Promise<SharingRule[]>;
  findByModule(moduleId: string): Promise<SharingRule[]>;
}

export class SharingRuleRepository implements ISharingRuleRepository {
  private tableName = 'sharing_rules';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<SharingRule | null> {
    const res = await this.query<SharingRule>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<SharingRule[]> {
    const res = await this.query<SharingRule>(
      `SELECT * FROM ${this.tableName}`
    );
    return res.rows;
  }

  async findActive(): Promise<SharingRule[]> {
    const res = await this.query<SharingRule>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true`
    );
    return res.rows;
  }

  async findByType(type: string): Promise<SharingRule[]> {
    const res = await this.query<SharingRule>(
      `SELECT * FROM ${this.tableName} WHERE rule_type = $1`,
      [type]
    );
    return res.rows;
  }

  async findByModule(moduleId: string): Promise<SharingRule[]> {
    const res = await this.query<SharingRule>(
      `SELECT * FROM ${this.tableName} WHERE module_id = $1`,
      [moduleId]
    );
    return res.rows;
  }

  async create(data: Partial<SharingRule>): Promise<SharingRule> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<SharingRule>(
      `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return res.rows[0]!;
  }

  async update(id: string, data: Partial<SharingRule>): Promise<SharingRule> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`SharingRule ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<SharingRule>(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (!res.rows[0]) throw new Error(`SharingRule ${id} not found`);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }
}
