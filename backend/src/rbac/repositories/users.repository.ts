import { Pool, QueryResultRow } from 'pg';
import { SymbolPlacement, TrailingZeroHandling, Users } from '../models/users.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateUserInput, UpdateUserInput } from '../types/repository.types';
import { UserStatus } from '../models/users.model';

export interface UserDetail {
  id: string;
  username: string;
  status: UserStatus;

  first_name: string | null;
  last_name: string;
  title: string | null;
  department: string | null;

  // Manager (JOINed)
  reports_to_user_id: string | null;
  reports_to_user_name: string | null;   // JOINed: manager's first_name + ' ' + last_name

  primary_email: string;
  secondary_email: string | null;
  other_email: string | null;

  office_phone: string | null;
  mobile_phone: string | null;
  home_phone: string | null;
  secondary_phone: string | null;
  fax: string | null;

  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;

  default_landing_page: string | null;
  name_format: string | null;
  phone_country_code: string | null;
  full_screen_preview: boolean | null;

  preferred_currency: string | null;
  digit_grouping_pattern: string | null;
  decimal_separator: string | null;
  decimal_precision: number | null;
  symbol_placement: SymbolPlacement | null;
  trailing_zero_handling: TrailingZeroHandling | null;

  time_zone: string | null;
  business_hours: Record<string, unknown> | null;

  aggregation_format: string | null;
  signature: string | null;

  // Assigned roles (JOINed)
  roles?: Array<{ id: string; name: string; code: string }>;

  // Assigned groups (JOINed)
  groups?: Array<{ id: string; name: string }>;

  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;        // JOINed: creator's first_name + ' ' + last_name
  updated_at: Date | null;
  last_login_at: Date | null;
  password_changed_at: Date | null;
}


export interface IUsersRepository {
  findById(userId: string, status: string): Promise<Users | null>;
  findByIdWithDetails(userId: string): Promise<UserDetail | null>;
  findAllPaginated(filters?: { status: string, email: string, username: string, name: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Users>>;
  create(input: CreateUserInput): Promise<Users>;
  update(input: Users): Promise<Users>;
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

  /**
   * Find user by ID (excludes deleted/inactive)
   */
  async findById(userId: string, status: string): Promise<Users | null> {
    const res = await this.query<Users>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND status = $2`,
      [userId, status]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find user by ID with JOINed manager name, creator name, roles, and groups
   */
  async findByIdWithDetails(userId: string): Promise<UserDetail | null> {
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
      WHERE u.id = $1`,
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
    const groupsrole = await this.query<{ id: string; name: string }>(
      `SELECT g.id,g.name
       FROM groups g
       INNER JOIN group_roles gr
       ON g.id = gr.group_id
       INNER JOIN roles r
       ON gr.role_id = r.id
       inner JOIN user_roles ur
       ON r.id = ur.role_id
       inner JOIN users u
       ON ur.user_id = u.id
       WHERE u.id = $1 and g.is_active = true and r.is_active = true`,
      [userId]
    )
    const allGroups = [...groupsRes.rows, ...groupsrole.rows];

    const groups = Array.from(
      new Map(allGroups.map(group => [group.id, group])).values()
    );

    return {
      ...user,
      reports_to_user_name: user.reports_to_user_name,
      created_by_name: user.created_by_name,
      roles: rolesRes.rows,
      groups: groups
    } as UserDetail;
  }
  /**
   * Find all users with pagination
   */
  async findAllPaginated(
    filters?: { status: string; email: string; username: string; name: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Users>> {

    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // ---- filters ----
    if (filters?.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters?.email) {
      whereClauses.push(`primary_email = $${paramIndex++}`);
      params.push(filters.email);
    }

    if (filters?.username) {
      whereClauses.push(`username = $${paramIndex++}`);
      params.push(filters.username);
    }

    if (filters?.name) {
      whereClauses.push(`(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`);
      params.push(`%${filters.name}%`);
      paramIndex++;
    }

    const whereSql = whereClauses.length
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // ---- total count ----
    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereSql}`,
      params
    );

    const total = parseInt(totalRes.rows[0]?.count ?? '0', 10);

    // ---- paginated data ----
    const dataRes = await this.query<Users>(
      `SELECT *
     FROM ${this.tableName}
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, p.limit, offset]
    );

    return buildPaginatedResult(dataRes.rows, total, p);
  }



  async create(input: CreateUserInput): Promise<Users> {
    const values = [
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
      input.business_hours ?? null,
      input.trailing_zero_handling ?? null,
      input.aggregation_format ?? null,
      input.signature ?? null,
      input.created_by ?? null,
    ]
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
      values
    );

    if (!res.rows[0]) throw new Error('User creation failed');
    return res.rows[0];
  }

  async update(input: Users): Promise<Users> {
    const values = [
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
      input.business_hours ?? null,
      input.trailing_zero_handling ?? null,
      input.aggregation_format ?? null,
      input.signature ?? null,
      input.created_by ?? null,
      input.id
    ]
    const res = await this.query<Users>(
      `UPDATE ${this.tableName}
       SET username = $1,
       password = $2,
       last_name = $3,
       primary_email = $4,
       status = $5,
       first_name = $6,
       title = $7,
       department = $8,
       reports_to_user_id = $9,
       secondary_email = $10,
       other_email = $11,
       office_phone = $12,
       mobile_phone = $13,
       home_phone = $14,
       secondary_phone = $15,
       fax = $16,
       street = $17,
       city = $18,
       state = $19,
       country = $20,
       postal_code = $21,
       default_landing_page = $22,
       name_format = $23,
       phone_country_code = $24,
       full_screen_preview = $25,
       preferred_currency = $26,
       digit_grouping_pattern = $27,
       decimal_separator = $28,
       decimal_precision = $29,
       symbol_placement = $30,
       time_zone = $31,
       business_hours = $32,
       trailing_zero_handling = $33,
       aggregation_format = $34,
       signature = $35,
       created_by = $36
       WHERE id = $37
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
