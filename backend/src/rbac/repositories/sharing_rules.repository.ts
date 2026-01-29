import { Pool, QueryResultRow } from 'pg';
import { SharingRules } from '../models/sharing_rules.model';

export interface ISharingRulesRepository {
  create(data: Partial<SharingRules>): Promise<SharingRules>;
  update(id: string, data: Partial<SharingRules>): Promise<SharingRules>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<SharingRules | null>;
  findAll(): Promise<SharingRules[]>;
  findActive(): Promise<SharingRules[]>;
  findByType(type: string): Promise<SharingRules[]>;
  findByModule(moduleId: string): Promise<SharingRules[]>;
}

export class SharingRulesRepository implements ISharingRulesRepository {
  private tableName = 'sharing_rules';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<SharingRules | null> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName}`
    );
    return res.rows;
  }

  async findActive(): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true`
    );
    return res.rows;
  }

  async findByType(type: string): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE rule_type = $1`,
      [type]
    );
    return res.rows;
  }

  async findByModule(moduleId: string): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE module_id = $1`,
      [moduleId]
    );
    return res.rows;
  }

  async create(data: Partial<SharingRules>): Promise<SharingRules> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<SharingRules>(
      `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return res.rows[0]!;
  }

  async update(id: string, data: Partial<SharingRules>): Promise<SharingRules> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`SharingRules ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<SharingRules>(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (!res.rows[0]) throw new Error(`SharingRules ${id} not found`);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }
}
