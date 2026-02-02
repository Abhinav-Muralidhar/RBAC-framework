import { Pool, QueryResultRow } from 'pg';
import { Modules } from '../models/modules.model';
import { CreateModuleInput } from '../types/repository.types';


export interface IModuleRepository {
  findAll(): Promise<Modules[]>;
  findByCode(code: string): Promise<Modules | null>;
  findById(id: string): Promise<Modules | null>;
  create(input: CreateModuleInput): Promise<Modules>;
  update(id: string, input: Modules): Promise<Modules>;
}

export class ModuleRepository implements IModuleRepository {
  private tableName = 'modules';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Modules | null> {
    const res = await this.query<Modules>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<Modules | null> {
    const res = await this.query<Modules>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<Modules[]> {
    const res = await this.query<Modules>(
      `SELECT * FROM ${this.tableName}`
    );
    return res.rows;
  }

  async create(input: CreateModuleInput): Promise<Modules> {
    const res = await this.query<Modules>(
      `INSERT INTO ${this.tableName} (name, code, description, is_active)
       VALUES ($1, $2, $3, COALESCE($4, true))
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.is_active ?? null
      ]
    );
    if (!res.rows[0]) throw new Error('Module creation failed');
    return res.rows[0];
  }

  async update(id: string, input: Modules): Promise<Modules> {
    const updates: string[] = [];
    const values: unknown[] = [id];
    let paramIdx = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(input.name);
    }
    if (input.code !== undefined) {
      updates.push(`code = $${paramIdx++}`);
      values.push(input.code);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(input.description);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.is_active);
    }

    if (!updates.length) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Module ${id} not found`);
      return existing;
    }

    updates.push('updated_at = NOW()');

    const res = await this.query<Modules>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
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
