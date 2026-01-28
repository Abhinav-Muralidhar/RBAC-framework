import { Pool, QueryResultRow } from 'pg';
import { Profile } from '../models/profile.model';

export interface IProfileRepository {
  create(data: Record<string, unknown>): Promise<Profile>;
  update(id: string, data: Record<string, unknown>): Promise<Profile>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Profile | null>;
  findByCode(code: string): Promise<Profile | null>;
  findAll(): Promise<Profile[]>;
  findActive(): Promise<Profile[]>;
  getAssignedPermissionIds(profileId: string): Promise<string[]>;
}

export class ProfileRepository implements IProfileRepository {
  private tableName = 'profiles';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Profile | null> {
    const res = await this.query<Profile>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByCode(code: string): Promise<Profile | null> {
    const res = await this.query<Profile>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
    return res.rows[0] || null;
  }

  async findAll(): Promise<Profile[]> {
    const res = await this.query<Profile>(`SELECT * FROM ${this.tableName}`);
    return res.rows;
  }

  async findActive(): Promise<Profile[]> {
    const res = await this.query<Profile>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true`
    );
    return res.rows;
  }

  async create(data: Record<string, unknown>): Promise<Profile> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const indices = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(',');

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${indices})
      RETURNING *
    `;
    const res = await this.query<Profile>(query, values);
    return res.rows[0]!;
  }

  async update(id: string, data: Record<string, unknown>): Promise<Profile> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    if (keys.length === 0) return this.findById(id) as Promise<Profile>;

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    const res = await this.query<Profile>(query, [id, ...values]);
    if (res.rows.length === 0) throw new Error(`Profile ${id} not found for update`);
    return res.rows[0]!;
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  async getAssignedPermissionIds(profileId: string): Promise<string[]> {
    const res = await this.query<{ permission_id: string }>(
      `SELECT permission_id FROM profile_permissions WHERE profile_id = $1`,
      [profileId]
    );
    return res.rows.map(row => row.permission_id);
  }
}
