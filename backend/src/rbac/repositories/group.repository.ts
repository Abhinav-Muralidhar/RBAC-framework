import { Pool, QueryResultRow } from 'pg';
import { Group } from '../models/groups.model';

export interface IGroupRepository {
  create(data: Partial<Group>): Promise<Group>;
  update(id: string, data: Partial<Group>): Promise<Group>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Group | null>;
  findAll(): Promise<Group[]>;
  findActive(): Promise<Group[]>;
  findInactive(): Promise<Group[]>;
  findByName(name: string): Promise<Group | null>;
}

export class GroupRepository implements IGroupRepository {
  private tableName = 'groups';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Group | null> {
    const res = await this.query<Group>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<Group[]> {
    const res = await this.query<Group>(`SELECT * FROM ${this.tableName}`);
    return res.rows;
  }

  async findActive(): Promise<Group[]> {
    const res = await this.query<Group>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true`
    );
    return res.rows;
  }

  async findInactive(): Promise<Group[]> {
    const res = await this.query<Group>(
      `SELECT * FROM ${this.tableName} WHERE is_active = false`
    );
    return res.rows;
  }

  async findByName(name: string): Promise<Group | null> {
    const res = await this.query<Group>(
      `SELECT * FROM ${this.tableName} WHERE name = $1`,
      [name]
    );
    return res.rows[0] ?? null;
  }

  async create(data: Partial<Group>): Promise<Group> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) throw new Error('Cannot create group with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Group>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return res.rows[0]!;
  }

  async update(id: string, data: Partial<Group>): Promise<Group> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Group ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');

    const res = await this.query<Group>(
      `UPDATE ${this.tableName}
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    if (res.rows.length === 0) throw new Error(`Group ${id} not found for update`);
    return res.rows[0]!;
  }

  async delete(id: string): Promise<void> {
    // Soft delete
    await this.query(
      `UPDATE ${this.tableName}
       SET is_active = false
       WHERE id = $1`,
      [id]
    );
  }
}
