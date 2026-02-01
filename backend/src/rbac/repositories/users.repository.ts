import { Pool, QueryResultRow } from 'pg';
import { Users } from '../models/users.model';
import { UserListFilterDto, UserResponseDto } from '../dto/user.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateUserInput, UpdateUserInput } from '../types/repository.types';

export interface IUsersRepository {
  findById(userId: string): Promise<Users | null>;
  findByIdWithDetails(userId: string): Promise<UserResponseDto | null>;
  findByIdIncludingDeleted(userId: string): Promise<Users | null>;
  findByUsername(username: string): Promise<Users | null>;
  findByEmail(email: string): Promise<Users | null>;
  findAll(filters?: UserListFilterDto): Promise<Users[]>;
  findAllPaginated(filters?: UserListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
  create(input: CreateUserInput): Promise<Users>;
  update(userId: string, input: UpdateUserInput): Promise<Users>;
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
   * Find user by ID with JOINed manager name, creator name, roles, and groups
   */
  async findByIdWithDetails(userId: string): Promise<UserResponseDto | null> {
    // Get the user with manager and creator names
    const userRes = await this.query<Users & {
      reports_to_user_name: string | null;
      created_by_name: string | null;
    }>(
      `SELECT 
        u.*,
        CASE 
          WHEN m.id IS NOT NULL THEN COALESCE(m.first_name, '') || ' ' || m.last_name
          ELSE NULL
        END AS reports_to_user_name,
        CASE 
          WHEN c.id IS NOT NULL THEN COALESCE(c.first_name, '') || ' ' || c.last_name
          ELSE NULL
        END AS created_by_name
      FROM ${this.tableName} u
      LEFT JOIN ${this.tableName} m ON u.reports_to_user_id = m.id
      LEFT JOIN ${this.tableName} c ON u.created_by = c.id
      WHERE u.id = $1 AND u.${ACTIVE_USER_FILTER}`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) return null;

    // Get user's roles
    const rolesRes = await this.query<{ id: string; name: string; code: string }>(
      `SELECT r.id, r.name, r.code
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = true`,
      [userId]
    );

    // Get user's groups
    const groupsRes = await this.query<{ id: string; name: string }>(
      `SELECT g.id, g.name
       FROM groups g
       INNER JOIN user_groups ug ON g.id = ug.group_id
       WHERE ug.user_id = $1 AND g.is_active = true`,
      [userId]
    );

    return {
      ...user,
      reports_to_user_name: user.reports_to_user_name,
      created_by_name: user.created_by_name,
      roles: rolesRes.rows,
      groups: groupsRes.rows
    } as UserResponseDto;
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

  async create(input: CreateUserInput): Promise<Users> {
    const res = await this.query<Users>(
      `INSERT INTO ${this.tableName} (
        username, password, last_name, primary_email,
        status, first_name, title, department, reports_to_user_id,
        secondary_email, other_email, office_phone, mobile_phone,
        home_phone, secondary_phone, fax, street, city, state,
        country, postal_code, default_landing_page, name_format,
        phone_country_code, full_screen_preview, preferred_currency,
        digit_grouping_pattern, decimal_separator, decimal_precision,
        symbol_placement, time_zone, business_hours, trailing_zero_handling,
        aggregation_format, signature, created_by
      ) VALUES (
        $1, $2, $3, $4,
        COALESCE($5, 'active'), $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29,
        $30, $31, $32, $33,
        $34, $35, $36
      ) RETURNING *`,
      [
        input.username,
        input.password,
        input.last_name,
        input.primary_email,
        input.status ?? null,
        input.first_name ?? null,
        input.title ?? null,
        input.department ?? null,
        input.reports_to_user_id ?? null,
        input.secondary_email ?? null,
        input.other_email ?? null,
        input.office_phone ?? null,
        input.mobile_phone ?? null,
        input.home_phone ?? null,
        input.secondary_phone ?? null,
        input.fax ?? null,
        input.street ?? null,
        input.city ?? null,
        input.state ?? null,
        input.country ?? null,
        input.postal_code ?? null,
        input.default_landing_page ?? null,
        input.name_format ?? null,
        input.phone_country_code ?? null,
        input.full_screen_preview ?? null,
        input.preferred_currency ?? null,
        input.digit_grouping_pattern ?? null,
        input.decimal_separator ?? null,
        input.decimal_precision ?? null,
        input.symbol_placement ?? null,
        input.time_zone ?? null,
        input.business_hours ? JSON.stringify(input.business_hours) : null,
        input.trailing_zero_handling ?? null,
        input.aggregation_format ?? null,
        input.signature ?? null,
        input.created_by ?? null
      ]
    );

    if (!res.rows[0]) throw new Error('User creation failed');
    return res.rows[0];
  }

  async update(userId: string, input: UpdateUserInput): Promise<Users> {
    // Build SET clause only for provided fields
    const updates: string[] = [];
    const values: unknown[] = [userId];
    let paramIdx = 2;

    if (input.password !== undefined) {
      updates.push(`password = $${paramIdx++}`);
      values.push(input.password);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(input.status);
    }
    if (input.first_name !== undefined) {
      updates.push(`first_name = $${paramIdx++}`);
      values.push(input.first_name);
    }
    if (input.last_name !== undefined) {
      updates.push(`last_name = $${paramIdx++}`);
      values.push(input.last_name);
    }
    if (input.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(input.title);
    }
    if (input.department !== undefined) {
      updates.push(`department = $${paramIdx++}`);
      values.push(input.department);
    }
    if (input.reports_to_user_id !== undefined) {
      updates.push(`reports_to_user_id = $${paramIdx++}`);
      values.push(input.reports_to_user_id);
    }
    if (input.primary_email !== undefined) {
      updates.push(`primary_email = $${paramIdx++}`);
      values.push(input.primary_email);
    }
    if (input.secondary_email !== undefined) {
      updates.push(`secondary_email = $${paramIdx++}`);
      values.push(input.secondary_email);
    }
    if (input.other_email !== undefined) {
      updates.push(`other_email = $${paramIdx++}`);
      values.push(input.other_email);
    }
    if (input.office_phone !== undefined) {
      updates.push(`office_phone = $${paramIdx++}`);
      values.push(input.office_phone);
    }
    if (input.mobile_phone !== undefined) {
      updates.push(`mobile_phone = $${paramIdx++}`);
      values.push(input.mobile_phone);
    }
    if (input.home_phone !== undefined) {
      updates.push(`home_phone = $${paramIdx++}`);
      values.push(input.home_phone);
    }
    if (input.secondary_phone !== undefined) {
      updates.push(`secondary_phone = $${paramIdx++}`);
      values.push(input.secondary_phone);
    }
    if (input.fax !== undefined) {
      updates.push(`fax = $${paramIdx++}`);
      values.push(input.fax);
    }
    if (input.street !== undefined) {
      updates.push(`street = $${paramIdx++}`);
      values.push(input.street);
    }
    if (input.city !== undefined) {
      updates.push(`city = $${paramIdx++}`);
      values.push(input.city);
    }
    if (input.state !== undefined) {
      updates.push(`state = $${paramIdx++}`);
      values.push(input.state);
    }
    if (input.country !== undefined) {
      updates.push(`country = $${paramIdx++}`);
      values.push(input.country);
    }
    if (input.postal_code !== undefined) {
      updates.push(`postal_code = $${paramIdx++}`);
      values.push(input.postal_code);
    }
    if (input.default_landing_page !== undefined) {
      updates.push(`default_landing_page = $${paramIdx++}`);
      values.push(input.default_landing_page);
    }
    if (input.name_format !== undefined) {
      updates.push(`name_format = $${paramIdx++}`);
      values.push(input.name_format);
    }
    if (input.phone_country_code !== undefined) {
      updates.push(`phone_country_code = $${paramIdx++}`);
      values.push(input.phone_country_code);
    }
    if (input.full_screen_preview !== undefined) {
      updates.push(`full_screen_preview = $${paramIdx++}`);
      values.push(input.full_screen_preview);
    }
    if (input.preferred_currency !== undefined) {
      updates.push(`preferred_currency = $${paramIdx++}`);
      values.push(input.preferred_currency);
    }
    if (input.digit_grouping_pattern !== undefined) {
      updates.push(`digit_grouping_pattern = $${paramIdx++}`);
      values.push(input.digit_grouping_pattern);
    }
    if (input.decimal_separator !== undefined) {
      updates.push(`decimal_separator = $${paramIdx++}`);
      values.push(input.decimal_separator);
    }
    if (input.decimal_precision !== undefined) {
      updates.push(`decimal_precision = $${paramIdx++}`);
      values.push(input.decimal_precision);
    }
    if (input.symbol_placement !== undefined) {
      updates.push(`symbol_placement = $${paramIdx++}`);
      values.push(input.symbol_placement);
    }
    if (input.time_zone !== undefined) {
      updates.push(`time_zone = $${paramIdx++}`);
      values.push(input.time_zone);
    }
    if (input.business_hours !== undefined) {
      updates.push(`business_hours = $${paramIdx++}`);
      values.push(input.business_hours ? JSON.stringify(input.business_hours) : null);
    }
    if (input.trailing_zero_handling !== undefined) {
      updates.push(`trailing_zero_handling = $${paramIdx++}`);
      values.push(input.trailing_zero_handling);
    }
    if (input.aggregation_format !== undefined) {
      updates.push(`aggregation_format = $${paramIdx++}`);
      values.push(input.aggregation_format);
    }
    if (input.signature !== undefined) {
      updates.push(`signature = $${paramIdx++}`);
      values.push(input.signature);
    }
    if (input.last_login_at !== undefined) {
      updates.push(`last_login_at = $${paramIdx++}`);
      values.push(input.last_login_at);
    }
    if (input.password_changed_at !== undefined) {
      updates.push(`password_changed_at = $${paramIdx++}`);
      values.push(input.password_changed_at);
    }

    if (updates.length === 0) {
      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    updates.push('updated_at = NOW()');

    const res = await this.query<Users>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1 AND ${ACTIVE_USER_FILTER}
       RETURNING *`,
      values
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
