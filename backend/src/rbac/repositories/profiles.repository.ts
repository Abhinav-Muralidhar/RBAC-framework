import { Pool, QueryResultRow } from 'pg';
import { Profiles } from '../models/profiles.model';

export interface IProfilesRepository {
  create(data: Record<string, unknown>): Promise<Profiles>;
  update(id: string, data: Record<string, unknown>): Promise<Profiles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Profiles | null>;
  findByCode(code: string): Promise<Profiles | null>;
  findAll(): Promise<Profiles[]>;
  findActive(): Promise<Profiles[]>;
  findInactive(): Promise<Profiles[]>;
}

export class ProfilesRepository implements IProfilesRepository {
  private tableName = 'profiles';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Profiles | null> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByCode(code: string): Promise<Profiles | null> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
    return res.rows[0] || null;
  }

  async findAll(): Promise<Profiles[]> {
    const res = await this.query<Profiles>(`SELECT * FROM ${this.tableName}`);
    return res.rows;
  }

  async findActive(): Promise<Profiles[]> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true`
    );
    return res.rows;
  }
  async findInactive(): Promise<Profiles[]> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE is_active = false`
    );
    return res.rows!;
  }
  async create(data: Record<string, unknown>): Promise<Profiles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const indices = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(',');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${indices})
      RETURNING *
    `;
    const res = await this.query<Profiles>(query, values);
    return res.rows[0]!;
  }

  async update(id: string, data: Record<string, unknown>): Promise<Profiles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    if (keys.length === 0) return this.findById(id) as Promise<Profiles>;

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    const res = await this.query<Profiles>(query, [id, ...values]);
    if (res.rows.length === 0) throw new Error(`Profiles ${id} not found for update`);
    return res.rows[0]!;
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }


}
