import { Pool, QueryResultRow } from 'pg';
import { Module } from '../models/module.model';

export interface IModuleRepository {
  findAll(filters?: Record<string, unknown>): Promise<Module[]>;
  findByCode(code: string): Promise<Module | null>;
  findById(id: string): Promise<Module | null>;
  create(data: Partial<Module>): Promise<Module>;
  update(id: string, data: Partial<Module>): Promise<Module>;
}

export class ModuleRepository implements IModuleRepository {
  private tableName = 'modules';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Module | null> {
    const res = await this.query<Module>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<Module | null> {
    const res = await this.query<Module>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: Record<string, unknown>): Promise<Module[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const clauses = Object.entries(filters).map(([key, value], i) => {
        params.push(value);
        return `${key} = $${i + 1}`;
      });
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    const res = await this.query<Module>(query, params);
    return res.rows;
  }

  async create(data: Partial<Module>): Promise<Module> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) throw new Error('Cannot create module with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Module>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
  }
  async update(id: string, data: Partial<Module>): Promise<Module> {
    const keys = Object.keys(data);
    if (!keys.length) throw new Error('No fields provided for update');

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

    const res = await this.query<Module>(
        `UPDATE ${this.tableName}
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${keys.length + 1}
        RETURNING *`,
        [...values, id]
    );

    if (!res.rows[0]) throw new Error('Module not found for update');
    return res.rows[0];
    }

  async delete(id: string): Promise<void> {
    await this.query(
        `UPDATE ${this.tableName} SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [id]
    );
    }

}
