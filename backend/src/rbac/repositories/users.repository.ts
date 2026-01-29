import { Pool, QueryResultRow } from 'pg';
import { Users } from '../models/users.model';

export interface IUsersRepository {
  findById(userId: string): Promise<Users | null>;
  findByUsername(username: string): Promise<Users | null>;
  findByEmail(email: string): Promise<Users | null>;
  findAll(filters?: Record<string, unknown>): Promise<Users[]>;
  create(data: Partial<Users>): Promise<Users>;
  update(userId: string, data: Partial<Users>): Promise<Users>;
  delete(userId: string): Promise<void>;
}

export class UsersRepository implements IUsersRepository {
  private tableName = 'users';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(userId: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  async findByUsername(username: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE username = $1`,
      [username]
    );
    return res.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE primary_email = $1`,
      [email]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: Record<string, unknown>): Promise<Users[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const clauses = Object.entries(filters).map(([key, value], i) => {
        params.push(value);
        return `${key} = $${i + 1}`;
      });
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    const res = await this.query<Users>(sql, params);
    return res.rows;
  }

  async create(data: Partial<Users>): Promise<Users> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      throw new Error('Cannot create user with empty payload');
    }

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Users>(
      `INSERT INTO ${this.tableName} (${columns})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    if (!res.rows[0]) throw new Error('User creation failed');
    return res.rows[0];
  }

  async update(userId: string, data: Partial<Users>): Promise<Users> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<Users>(
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
}
