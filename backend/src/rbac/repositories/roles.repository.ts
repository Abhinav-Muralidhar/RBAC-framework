import { Pool, QueryResultRow } from 'pg';
import { Roles } from '../models/roles.model';
import { RoleListFilterDto, RoleResponseDto } from '../dto/role.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateRoleInput, UpdateRoleInput } from '../types/repository.types';

export interface IRoleRepository {
  create(input: CreateRoleInput): Promise<Roles>;
  update(id: string, input: UpdateRoleInput): Promise<Roles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Roles | null>;
  findByIdWithDetails(id: string): Promise<RoleResponseDto | null>;
  findByIdIncludingInactive(id: string): Promise<Roles | null>;
  findByCode(code: string): Promise<Roles | null>;
  findAll(filters?: RoleListFilterDto): Promise<Roles[]>;
  findAllPaginated(filters?: RoleListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
  findAncestors(roleId: string): Promise<Roles[]>;
  findChildRoles(roleId: string): Promise<Roles[]>;
  findRoleTree(): Promise<Roles[]>;
  count(filters?: RoleListFilterDto): Promise<number>;
}

// Active role filter
const ACTIVE_FILTER = `is_active = true`;

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
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find role by ID with JOINed parent role, profiles, user count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<RoleResponseDto | null> {
    // Get the role with parent role and creator names
    const roleRes = await this.query<Roles & {
      parent_role_name: string | null;
      parent_role_code: string | null;
      created_by_name: string | null;
      user_count: string;
      child_role_count: string;
    }>(
      `SELECT 
        r.*,
        pr.name AS parent_role_name,
        pr.code AS parent_role_code,
        CASE 
          WHEN u.id IS NOT NULL THEN COALESCE(u.first_name, '') || ' ' || u.last_name
          ELSE NULL
        END AS created_by_name,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
        (SELECT COUNT(*) FROM roles cr WHERE cr.parent_role_id = r.id AND cr.is_active = true) AS child_role_count
      FROM ${this.tableName} r
      LEFT JOIN ${this.tableName} pr ON r.parent_role_id = pr.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1 AND r.${ACTIVE_FILTER}`,
      [id]
    );

    const role = roleRes.rows[0];
    if (!role) return null;

    // Get assigned profiles
    const profilesRes = await this.query<{ id: string; name: string; code: string }>(
      `SELECT p.id, p.name, p.code
       FROM profiles p
       INNER JOIN role_profiles rp ON p.id = rp.profile_id
       WHERE rp.role_id = $1 AND p.is_active = true`,
      [id]
    );

    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description ?? null,
      is_active: role.is_active,
      parent_role_id: role.parent_role_id ?? null,
      parent_role: role.parent_role_id ? {
        id: role.parent_role_id,
        name: role.parent_role_name!,
        code: role.parent_role_code!
      } : null,
      profiles: profilesRes.rows,
      user_count: parseInt(role.user_count, 10),
      child_role_count: parseInt(role.child_role_count, 10),
      created_at: role.created_at,
      created_by: role.created_by ?? null,
      created_by_name: role.created_by_name ?? null
    };
  }

  async findByIdIncludingInactive(id: string): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1 AND ${ACTIVE_FILTER}`,
      [code]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: RoleListFilterDto): Promise<Roles[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.parent_role_id) {
        params.push(filters.parent_role_id);
        sql += ` AND parent_role_id = $${paramIndex++}`;
      }
    }

    sql += ` ORDER BY created_at DESC`;
    const res = await this.query<Roles>(sql, params);
    return res.rows;
  }

  async findAllPaginated(
    filters?: RoleListFilterDto,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Roles>> {
    const normalizedPagination = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

    const total = await this.count(filters);

    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.parent_role_id) {
      params.push(filters.parent_role_id);
      sql += ` AND parent_role_id = $${paramIndex++}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(normalizedPagination.limit, offset);

    const res = await this.query<Roles>(sql, params);
    return buildPaginatedResult(res.rows, total, normalizedPagination);
  }

  async count(filters?: RoleListFilterDto): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.parent_role_id) {
      params.push(filters.parent_role_id);
      sql += ` AND parent_role_id = $${paramIndex++}`;
    }

    const res = await this.query<{ count: string }>(sql, params);
    return parseInt(res.rows[0]?.count ?? '0', 10);
  }

  async findChildRoles(roleId: string): Promise<Roles[]> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE parent_role_id = $1 AND ${ACTIVE_FILTER}`,
      [roleId]
    );
    return res.rows;
  }

  async findAncestors(roleId: string): Promise<Roles[]> {
    const query = `
            WITH RECURSIVE ancestors AS (
                SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}
                UNION ALL
                SELECT r.* FROM ${this.tableName} r
                INNER JOIN ancestors a ON a.parent_role_id = r.id
                WHERE r.is_active = true
            )
            SELECT * FROM ancestors WHERE id != $1;
        `;
    const res = await this.query<Roles>(query, [roleId]);
    return res.rows;
  }

  async create(input: CreateRoleInput): Promise<Roles> {
    const res = await this.query<Roles>(
      `INSERT INTO ${this.tableName} (name, code, description, parent_role_id, is_active, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, true), $6)
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.parent_role_id ?? null,
        input.is_active ?? null,
        input.created_by ?? null
      ]
    );
    if (!res.rows[0]) throw new Error('Role creation failed');
    return res.rows[0];
  }

  async update(id: string, input: UpdateRoleInput): Promise<Roles> {
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
    if (input.parent_role_id !== undefined) {
      updates.push(`parent_role_id = $${paramIdx++}`);
      values.push(input.parent_role_id);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Role ${id} not found`);
      return existing;
    }

    const res = await this.query<Roles>(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = $1 AND ${ACTIVE_FILTER} RETURNING *`,
      values
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
                SELECT * FROM ${this.tableName}
                WHERE parent_role_id IS NULL AND ${ACTIVE_FILTER}
                UNION ALL
                SELECT r.* FROM ${this.tableName} r
                INNER JOIN role_tree rt ON r.parent_role_id = rt.id
                WHERE r.is_active = true
            )
            SELECT * FROM role_tree;
        `;
    const res = await this.query<Roles>(query);
    return res.rows;
  }
}
