import { Pool, QueryResultRow } from 'pg';
import { User } from '../models/users.model';

export interface IUserRepository {
  findById(userId: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(filters?: Record<string, unknown>): Promise<User[]>;
  create(data: Partial<User>): Promise<User>;
  update(userId: string, data: Partial<User>): Promise<User>;
  delete(userId: string): Promise<void>;

  addRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  replaceRoles(userId: string, roleIds: string[]): Promise<void>;
}

export class UserRepository implements IUserRepository {
  private tableName = 'users';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(userId: string): Promise<User | null> {
    const res = await this.query<User>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const res = await this.query<User>(
      `SELECT * FROM ${this.tableName} WHERE username = $1`,
      [username]
    );
    return res.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.query<User>(
      `SELECT * FROM ${this.tableName} WHERE primary_email = $1`,
      [email]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: Record<string, unknown>): Promise<User[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const clauses = Object.entries(filters).map(([key, value], i) => {
        params.push(value);
        return `${key} = $${i + 1}`;
      });
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    const res = await this.query<User>(sql, params);
    return res.rows;
  }

  async create(data: Partial<User>): Promise<User> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      throw new Error('Cannot create user with empty payload');
    }

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<User>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    if (!res.rows[0]) throw new Error('User creation failed');
    return res.rows[0];
  }

  async update(userId: string, data: Partial<User>): Promise<User> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<User>(
      `UPDATE ${this.tableName}
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId, ...values]
    );

    if (!res.rows[0]) throw new Error('User not found for update');
    return res.rows[0];
  }

  async delete(userId: string): Promise<void> {
    // soft delete
    await this.query(
      `UPDATE ${this.tableName}
       SET status = 'deleted', updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  /* ---------------- ROLES ---------------- */

  async addRole(userId: string, roleId: string): Promise<void> {
    await this.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleId]
    );
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.query(
      `
      DELETE FROM user_roles
      WHERE user_id = $1 AND role_id = $2
      `,
      [userId, roleId]
    );
  }

  async replaceRoles(userId: string, roleIds: string[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM user_roles WHERE user_id = $1`,
        [userId]
      );

      for (const roleId of roleIds) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
          [userId, roleId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
