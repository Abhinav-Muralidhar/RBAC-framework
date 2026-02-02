import { Pool, QueryResultRow } from 'pg';
import { Roles } from '../models/roles.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateRoleInput, UpdateRoleInput } from '../types/repository.types';

export interface RoleDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  parent_role_id: string | null;
  parent_role: {
    name: string;
    code: string;
  } | null;

  // Assigned profiles (JOINed with names)
  profiles: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  user_count?: number;
  child_role_count?: number;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
}

export interface IRoleRepository {
  create(input: CreateRoleInput): Promise<Roles>;
  update(id: string, input: UpdateRoleInput): Promise<Roles>;
  delete(id: string): Promise<void>;
  findById(id: string, isActive?: boolean): Promise<Roles | null>;
  findByIdWithDetails(id: string): Promise<RoleDetail | null>;
  findByCode(code: string, isActive?: boolean): Promise<Roles | null>;
  findAllPaginated(filters?: { parent_role_id?: string, is_active?: boolean, search?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Roles>>;
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

  async findById(id: string, isActive?: boolean): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = $2`,
      [id, isActive]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find role by ID with JOINed parent role, profiles, user count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<RoleDetail | null> {
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
      WHERE r.id = $1`,
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

  async findByCode(code: string, is_active?: boolean): Promise<Roles | null> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1 AND is_active = $2`,
      [code, is_active]
    );
    return res.rows[0] ?? null;
  }

  async findAllPaginated(
    filters?: { parent_role_id?: string; is_active?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Roles>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.parent_role_id) {
      conditions.push(`parent_role_id = $${idx++}`);
      values.push(filters.parent_role_id);
    }
    if (filters?.is_active !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      values.push(filters.is_active);
    }
    if (filters?.search) {
      conditions.push(`(name ILIKE $${idx} OR code ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      values
    );
    const total = parseInt(totalRes.rows[0]?.count ?? '0', 10);

    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, p.limit, offset]
    );

    return buildPaginatedResult(res.rows, total, p);
  }

  async findChildRoles(roleId: string): Promise<Roles[]> {
    const res = await this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE parent_role_id = $1 AND is_active = true`,
      [roleId]
    );
    return res.rows;
  }

  async findAncestors(roleId: string): Promise<Roles[]> {
    const query = `
            WITH RECURSIVE ancestors AS (
                SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = true
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

  async update(id: string, input: Roles): Promise<Roles> {

    const res = await this.query<Roles>(
      `UPDATE ${this.tableName} SET name = $2, code = $3, description = $4, parent_role_id = $5, is_active = $6 WHERE id = $1 RETURNING *`,
      [
        id,
        input.name,
        input.code,
        input.description ?? null,
        input.parent_role_id ?? null,
        input.is_active ?? null,
      ]
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
                WHERE parent_role_id IS NULL AND is_active = true
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
