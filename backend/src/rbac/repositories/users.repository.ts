import { Pool, QueryResultRow } from 'pg';
import { Users } from '../models/users.model';
import { UserListFilterDto } from '../dto/user.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export interface IUsersRepository {
  findById(userId: string): Promise<Users | null>;
  findByIdIncludingDeleted(userId: string): Promise<Users | null>;
  findByUsername(username: string): Promise<Users | null>;
  findByEmail(email: string): Promise<Users | null>;
  findAll(filters?: UserListFilterDto): Promise<Users[]>;
  findAllPaginated(filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
  create(data: Partial<Users>): Promise<Users>;
  update(userId: string, data: Partial<Users>): Promise<Users>;
  delete(userId: string): Promise<void>;
  count(filters?: UserListFilterDto): Promise<number>;
}

// Active user filter: excludes deleted and inactive
const ACTIVE_USER_FILTER = `status NOT IN ('deleted', 'inactive')`;

export class UsersRepository implements IUsersRepository {
  private tableName = 'users';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  /**
   * Find user by ID (excludes deleted/inactive)
   */
  async findById(userId: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_USER_FILTER}`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find user by ID including deleted (admin use only)
   */
  async findByIdIncludingDeleted(userId: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find user by username (excludes deleted/inactive)
   */
  async findByUsername(username: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE username = $1 AND ${ACTIVE_USER_FILTER}`,
      [username]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find user by email (excludes deleted/inactive)
   */
  async findByEmail(email: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE primary_email = $1 AND ${ACTIVE_USER_FILTER}`,
      [email]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find all users with typed filters (excludes deleted/inactive)
   */
  async findAll(filters?: UserListFilterDto): Promise<Users[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_USER_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.status !== undefined) {
        params.push(filters.status);
        sql += ` AND status = $${paramIndex++}`;
      }
      if (filters.department) {
        params.push(filters.department);
        sql += ` AND department = $${paramIndex++}`;
      }
      if (filters.reports_to_user_id) {
        params.push(filters.reports_to_user_id);
        sql += ` AND reports_to_user_id = $${paramIndex++}`;
      }
      if (filters.city) {
        params.push(filters.city);
        sql += ` AND city = $${paramIndex++}`;
      }
      if (filters.state) {
        params.push(filters.state);
        sql += ` AND state = $${paramIndex++}`;
      }
      if (filters.country) {
        params.push(filters.country);
        sql += ` AND country = $${paramIndex++}`;
      }
    }

    sql += ` ORDER BY created_at DESC`;
    const res = await this.query<Users>(sql, params);
    return res.rows;
  }

  /**
   * Find all users with pagination
   */
  async findAllPaginated(
    filters?: UserListFilterDto,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Users>> {
    const normalizedPagination = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

    // Get total count
    const total = await this.count(filters);

    // Get paginated data
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_USER_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.status !== undefined) {
        params.push(filters.status);
        sql += ` AND status = $${paramIndex++}`;
      }
      if (filters.department) {
        params.push(filters.department);
        sql += ` AND department = $${paramIndex++}`;
      }
      if (filters.reports_to_user_id) {
        params.push(filters.reports_to_user_id);
        sql += ` AND reports_to_user_id = $${paramIndex++}`;
      }
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(normalizedPagination.limit, offset);

    const res = await this.query<Users>(sql, params);
    return buildPaginatedResult(res.rows, total, normalizedPagination);
  }

  /**
   * Count users with filters
   */
  async count(filters?: UserListFilterDto): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_USER_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.id) {
        params.push(filters.id);
        sql += ` AND id = $${paramIndex++}`;
      }
      if (filters.username) {
        params.push(filters.username);
        sql += ` AND username = $${paramIndex++}`;
      }
      if (filters.status !== undefined) {
        params.push(filters.status);
        sql += ` AND status = $${paramIndex++}`;
      }
      if (filters.department) {
        params.push(filters.department);
        sql += ` AND department = $${paramIndex++}`;
      }
      if (filters.reports_to_user_id) {
        params.push(filters.reports_to_user_id);
        sql += ` AND reports_to_user_id = $${paramIndex++}`;
      }
    }

    const res = await this.query<{ count: string }>(sql, params);
    return parseInt(res.rows[0]?.count ?? '0', 10);
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
             WHERE id = $1 AND ${ACTIVE_USER_FILTER}
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
