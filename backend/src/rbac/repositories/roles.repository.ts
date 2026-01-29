import { Pool, QueryResultRow } from 'pg';
import { Roles } from '../models/roles.model';

export interface IRoleRepository {
  create(data: Partial<Roles>): Promise<Roles>;
  update(id: string, data: Partial<Roles>): Promise<Roles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Roles | null>;
  findByCode(code: string): Promise<Roles | null>;
  findAll(): Promise<Roles[]>;
  findAncestors(roleId: string): Promise<Roles[]>;
  findChildRoles(roleId: string): Promise<Roles[]>;
  findRoleTree(): Promise<Roles[]>;
}

export class RoleRepository implements IRoleRepository {
  private tableName = 'roles';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
    return res.rows[0] ?? null;
  }

  async findAll(): Promise<Roles[]> {
    const res = await this.query<Roles>(`SELECT * FROM ${this.tableName}`);
    return res.rows;
  }

  async findChildRoles(roleId: string): Promise<Roles[]> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE parent_role_id = $1`,
      [roleId]
    );
    return res.rows;
  }

  async findAncestors(roleId: string): Promise<Roles[]> {
    const query = `
      WITH RECURSIVE ancestors AS (
        SELECT * FROM ${this.tableName} WHERE id = $1
        UNION ALL
        SELECT r.* FROM ${this.tableName} r
        INNER JOIN ancestors a ON a.parent_role_id = r.id
      )
      SELECT * FROM ancestors WHERE id != $1;
    `;
    const res = await this.query<Roles>(query, [roleId]);
    return res.rows;
  }

  async create(data: Partial<Roles>): Promise<Roles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Roles>(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return res.rows[0]!;
  }

  async update(id: string, data: Partial<Roles>): Promise<Roles> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Role ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<Roles>(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (!res.rows[0]) throw new Error(`Role ${id} not found`);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  async findRoleTree(): Promise<Roles[]> {
    const query = `
    WITH RECURSIVE role_tree AS (
      SELECT
        id,
        name,
        code,
        description,
        parent_role_id,
        is_active,
        created_at,
        created_by
      FROM ${this.tableName}
      WHERE parent_role_id IS NULL
        AND is_active = true

      UNION ALL

      SELECT
        r.id,
        r.name,
        r.code,
        r.description,
        r.parent_role_id,
        r.is_active,
        r.created_at,
        r.created_by
      FROM ${this.tableName} r
      INNER JOIN role_tree rt ON r.parent_role_id = rt.id
      WHERE r.is_active = true
    )
    SELECT * FROM role_tree;
  `;

    const res = await this.query<Roles>(query);
    return res.rows;
  }

}
