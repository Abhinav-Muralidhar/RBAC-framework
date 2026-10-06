import { IDatabase, ITask } from 'pg-promise';
import { Roles } from '../models/roles.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../../utils/pagination.utils';
import { CreateRoleInput, UpdateRoleInput } from '../types/repository.types';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface RoleDetail {
  id: string;
  version: number;
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
  updated_at: Date | null;
  updated_by: string | null;
  updated_by_name: string | null;  // JOINed: updater's name
}

export interface IRoleRepository {
  /** Insert a new role row. */
  create(t: ITask<unknown> | undefined, input: CreateRoleInput): Promise<Roles>;
  /** Update a role row with optimistic concurrency (version check). */
  update(t: ITask<unknown> | undefined, id: string, input: UpdateRoleInput): Promise<Roles>;
  /** Soft-delete a role (sets is_active = false). */
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
  /** Fetch a single role by primary key. */
  findById(t: ITask<unknown> | undefined, id: string, isActive?: boolean): Promise<Roles | null>;
  /** Fetch a role with JOINed audit names, parent info, and associated profiles. */
  findByIdWithDetails(t: ITask<unknown> | undefined, id: string): Promise<RoleDetail | null>;
  /** Look up a role by its unique code. */
  findByCode(t: ITask<unknown> | undefined, code: string, isActive?: boolean): Promise<Roles | null>;
  /** List roles with optional parent/active/search filters and pagination. */
  findAllPaginated(
    t: ITask<unknown> | undefined,
    filters?: { parent_role_id?: string; is_active?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Roles>>;
  /** Walk up the hierarchy and return all ancestor roles (with cycle detection). */
  findAncestors(t: ITask<unknown> | undefined, roleId: string): Promise<Roles[]>;
  /** Fetch all direct child roles of a given role. */
  findChildRoles(t: ITask<unknown> | undefined, roleId: string): Promise<Roles[]>;
  /** Build a flat list of all roles suitable for tree construction (with cycle detection). */
  findRoleTree(t: ITask<unknown> | undefined): Promise<Roles[]>;
  /** Fetch multiple roles by an array of IDs. */
  findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<Roles[]>;
  /** Check if a role has any active child roles (used before deletion). */
  hasActiveChildren(t: ITask<unknown> | undefined, roleId: string): Promise<boolean>;
}

export class RoleRepository implements IRoleRepository {
  private tableName = 'roles';
  private readonly baseColumns = 'id, version, name, code, description, parent_role_id, is_active, created_at, created_by, updated_at, updated_by';

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
        `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
        [numericId]
      );
    } else {
      // If `is_active` is provided, include it in the query
      return (t ?? this.db).oneOrNone<Roles>(
        `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1 AND is_active = $2`,
        [numericId, isActive]
      );
    }
  }

  async findByIds(
    t: ITask<unknown> | undefined,
    ids: string[]
  ): Promise<Roles[]> {
    return (t ?? this.db).any<Roles>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = ANY($1)`,
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
        r.id, r.version, r.name, r.code, r.description, r.parent_role_id, r.is_active, r.created_at, r.created_by, r.updated_at, r.updated_by,
        pr.name AS parent_role_name,
        pr.code AS parent_role_code,
        CASE 
          WHEN u.id IS NOT NULL THEN u.username
          ELSE NULL
        END AS created_by_name,
        CASE 
          WHEN ub.id IS NOT NULL THEN ub.username
          ELSE NULL
        END AS updated_by_name,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
        (SELECT COUNT(*) FROM roles cr WHERE cr.parent_role_id = r.id AND cr.is_active = true) AS child_role_count
      FROM ${this.tableName} r
      LEFT JOIN ${this.tableName} pr ON r.parent_role_id = pr.id
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN users ub ON r.updated_by = ub.id
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
      version: role.version,
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
      created_by_name: role.created_by_name ?? null,
      updated_at: role.updated_at ?? null,
      updated_by: (role as any).updated_by ?? null,
      updated_by_name: (role as any).updated_by_name ?? null
    };
  }

  async findByCode(
    t: ITask<unknown> | undefined,
    code: string,
    isActive?: boolean
  ): Promise<Roles | null> {
    if (isActive === undefined) {
      return (t ?? this.db).oneOrNone<Roles>(
        `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE code = $1`,
        [code]
      );
    }

    return (t ?? this.db).oneOrNone<Roles>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE code = $1 AND is_active = $2`,
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
      `SELECT id,name,code,description,is_active FROM ${this.tableName}
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
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE parent_role_id = $1 AND is_active = true`,
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
        SELECT ${this.baseColumns}, ARRAY[id] AS path
        FROM ${this.tableName} WHERE id = $1 AND is_active = true
        UNION ALL
        SELECT r.id, r.version, r.name, r.code, r.description, r.parent_role_id, r.is_active, r.created_at, r.created_by, r.updated_at, r.updated_by,
               a.path || r.id
        FROM ${this.tableName} r
        INNER JOIN ancestors a ON a.parent_role_id = r.id
        WHERE r.is_active = true
          AND NOT r.id = ANY(a.path)
      )
      SELECT id, version, name, code, description, parent_role_id, is_active, created_at, created_by, updated_at, updated_by FROM ancestors WHERE id != $1;
    `;
    return this.query<Roles>(query, [roleId], t);
  }

  async create(
    t: ITask<unknown> | undefined,
    input: CreateRoleInput
  ): Promise<Roles> {
    return (t ?? this.db).one<Roles>(
      `INSERT INTO ${this.tableName} (name, code, description, parent_role_id, is_active, created_by,updated_by,updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, true), $6,$7,NOW())
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.parent_role_id ?? null,
        input.is_active ?? null,
        input.created_by ?? null,
        input.created_by ?? null
      ]
    );
  }

  async update(
    t: ITask<unknown> | undefined,
    id: string,
    input: UpdateRoleInput
  ): Promise<Roles> {
    const row = await (t ?? this.db).oneOrNone<Roles>(
      `UPDATE ${this.tableName}
       SET name = $2,
           code = $3,
           description = $4,
           parent_role_id = $5,
           is_active = $6,
           updated_at = NOW(),
           updated_by = $7,
           version = version + 1
       WHERE id = $1 AND version = $8
       RETURNING *`,
      [
        id,
        input.name,
        input.code,
        input.description ?? null,
        input.parent_role_id ?? null,
        input.is_active ?? null,
        input.updated_by ?? null,
        input.version
      ]
    );

    if (!row) {
      throw new ConcurrentModificationError('Role', id);
    }

    return row;
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
        0 AS level,
        ARRAY[r.id]::bigint[] AS path
      FROM ${this.tableName} r
      WHERE r.parent_role_id IS NULL
        AND r.is_active = true

      UNION ALL

      SELECT
        r.id,
        r.name,
        r.parent_role_id,
        rt.level + 1,
        rt.path || r.id
      FROM ${this.tableName} r
      JOIN role_tree rt ON r.parent_role_id = rt.id
      WHERE r.is_active = true
        AND NOT (r.id = ANY(rt.path))
    )
    SELECT id, name, parent_role_id, level
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
