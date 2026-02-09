import { IDatabase, ITask } from 'pg-promise';
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

  // Parent role (JOINed)
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

  // Counts
  user_count?: number;
  child_role_count?: number;

  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;  // JOINed: creator's name
}

export interface IRoleRepository {
  create(t: ITask<unknown> | undefined, input: CreateRoleInput): Promise<Roles>;
  update(t: ITask<unknown> | undefined, id: string, input: UpdateRoleInput): Promise<Roles>;
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
  findById(t: ITask<unknown> | undefined, id: string, isActive?: boolean): Promise<Roles | null>;
  findByIdWithDetails(t: ITask<unknown> | undefined, id: string): Promise<RoleDetail | null>;
  findByCode(t: ITask<unknown> | undefined, code: string, isActive?: boolean): Promise<Roles | null>;
  findAllPaginated(
    t: ITask<unknown> | undefined,
    filters?: { parent_role_id?: string; is_active?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Roles>>;
  findAncestors(t: ITask<unknown> | undefined, roleId: string): Promise<Roles[]>;
  findChildRoles(t: ITask<unknown> | undefined, roleId: string): Promise<Roles[]>;
  findRoleTree(t: ITask<unknown> | undefined): Promise<Roles[]>;
  findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<Roles[]>;
  hasActiveChildren(t: ITask<unknown> | undefined, roleId: string): Promise<boolean>;
}

export class RoleRepository implements IRoleRepository {
  private tableName = 'roles';

  constructor(private db: IDatabase<unknown>) { }

  protected query<T>(
    text: string,
    params?: unknown[],
    t?: ITask<unknown>
  ): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findById(
    t: ITask<unknown> | undefined,
    id: string,
    isActive?: boolean
  ): Promise<Roles | null> {
    const numericId = BigInt(id);
    // If `is_active` is not provided, do not filter by it
    if (isActive === undefined) {
      return (t ?? this.db).oneOrNone<Roles>(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [numericId]
      );
    } else {
      // If `is_active` is provided, include it in the query
      return (t ?? this.db).oneOrNone<Roles>(
        `SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = $2`,
        [numericId, isActive]
      );
    }
  }

  async findByIds(
    t: ITask<unknown> | undefined,
    ids: string[]
  ): Promise<Roles[]> {
    return (t ?? this.db).any<Roles>(
      `SELECT * FROM ${this.tableName} WHERE id = ANY($1)`,
      [ids]
    );
  }

  /**
   * Find role by ID with JOINed parent role, profiles, user count, and creator name
   */
  async findByIdWithDetails(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<RoleDetail | null> {
    const role = await (t ?? this.db).oneOrNone<Roles & {
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

    if (!role) return null;

    const profiles = await this.query<{ id: string; name: string; code: string }>(
      `SELECT p.id, p.name, p.code
       FROM profiles p
       INNER JOIN role_profiles rp ON p.id = rp.profile_id
       WHERE rp.role_id = $1 AND p.is_active = true`,
      [id],
      t
    );

    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description ?? null,
      is_active: role.is_active,
      parent_role_id: role.parent_role_id ?? null,
      parent_role: role.parent_role_id
        ? { name: role.parent_role_name!, code: role.parent_role_code! }
        : null,
      profiles,
      user_count: parseInt(role.user_count, 10),
      child_role_count: parseInt(role.child_role_count, 10),
      created_at: role.created_at,
      created_by: role.created_by ?? null,
      created_by_name: role.created_by_name ?? null
    };
  }

  async findByCode(
    t: ITask<unknown> | undefined,
    code: string,
    isActive?: boolean
  ): Promise<Roles | null> {
    return (t ?? this.db).oneOrNone<Roles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1 AND is_active = $2`,
      [code, isActive]
    );
  }

  async findAllPaginated(
    t: ITask<unknown> | undefined,
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

    const total = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      values
    );

    const data = await this.query<Roles>(
      `SELECT * FROM ${this.tableName}
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, p.limit, offset],
      t
    );

    return buildPaginatedResult(data, parseInt(total.count, 10), p);
  }

  async findChildRoles(
    t: ITask<unknown> | undefined,
    roleId: string
  ): Promise<Roles[]> {
    return this.query<Roles>(
      `SELECT * FROM ${this.tableName} WHERE parent_role_id = $1 AND is_active = true`,
      [roleId],
      t
    );
  }

  async findAncestors(
    t: ITask<unknown> | undefined,
    roleId: string
  ): Promise<Roles[]> {
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
    return this.query<Roles>(query, [roleId], t);
  }

  async create(
    t: ITask<unknown> | undefined,
    input: CreateRoleInput
  ): Promise<Roles> {
    return (t ?? this.db).one<Roles>(
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
  }

  async update(
    t: ITask<unknown> | undefined,
    id: string,
    input: UpdateRoleInput
  ): Promise<Roles> {
    return (t ?? this.db).one<Roles>(
      `UPDATE ${this.tableName}
       SET name = $2,
           code = $3,
           description = $4,
           parent_role_id = $5,
           is_active = $6
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name,
        input.code,
        input.description ?? null,
        input.parent_role_id ?? null,
        input.is_active ?? null
      ]
    );
  }

  async delete(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<void> {
    await (t ?? this.db).none(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  async findRoleTree(
    t: ITask<unknown> | undefined
  ): Promise<Roles[]> {
    const query = `
      WITH RECURSIVE role_tree AS (
      SELECT
        r.id,
        r.name,
        r.parent_role_id,
        0 AS level
      FROM ${this.tableName} r
      WHERE r.parent_role_id IS NULL
        AND r.is_active = true

      UNION ALL

      SELECT
        r.id,
        r.name,
        r.parent_role_id,
        rt.level + 1
      FROM ${this.tableName} r
      JOIN role_tree rt ON r.parent_role_id = rt.id
      WHERE r.is_active = true
    )
    SELECT *
    FROM role_tree
    ORDER BY level, parent_role_id, id;
    `;
    return this.query<Roles>(query, [], t);
  }

  // check if role has any active children (used for delete guard)
  async hasActiveChildren(t: ITask<unknown> | undefined, roleId: string): Promise<boolean> {
    const result = await this.query<Roles>(
      `SELECT 1 FROM ${this.tableName} WHERE parent_role_id = $1 AND is_active = true LIMIT 1`,
      [roleId],
      t
    );
    return result.length > 0;
  }
}
