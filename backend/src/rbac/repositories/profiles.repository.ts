import { IDatabase, ITask } from 'pg-promise';
import { Profiles } from '../models/profiles.model';
import { PermissionEffect } from '../models/profile_permissions.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateProfileInput } from '../types/repository.types';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface ProfileDetail {
  id: string;
  version: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  permissions: Array<{
    id: string;
    action: string;
    effect: PermissionEffect;
    module_id: string;
    module_name: string;
    module_code: string;
  }>;
  role_count?: number;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
}

export interface IProfilesRepository {
  create(t: ITask<unknown> | undefined, input: CreateProfileInput): Promise<Profiles>;
  update(t: ITask<unknown> | undefined, id: string, input: Profiles): Promise<Profiles>;
  findById(t: ITask<unknown> | undefined, id: string): Promise<Profiles | null>;
  findByIdWithDetails(t: ITask<unknown> | undefined, id: string): Promise<ProfileDetail | null>;
  findAllPaginated(
    t: ITask<unknown> | undefined,
    filters?: { is_active?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Profiles>>;
  findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<Profiles[]>;
  findByRoles(t: ITask<unknown> | undefined, roleIds: string[]): Promise<Profiles[]>
}

export class ProfilesRepository implements IProfilesRepository {
  private tableName = 'profiles';

  constructor(private db: IDatabase<unknown>) { }

  protected query<T>(
    text: string,
    params?: unknown[],
    t?: ITask<unknown>
  ): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findByIds(
    t: ITask<unknown> | undefined,
    ids: string[]
  ): Promise<Profiles[]> {
    const numericIds = ids.map(id => BigInt(id));
    return (t ?? this.db).any<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = ANY($1::bigint[])`,
      [numericIds]
    );
  }

  async findByRoles(t: ITask<unknown> | undefined, roleIds: string[]): Promise<Profiles[]> {
    return (t ?? this.db).any<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = ANY($1)`,
      [roleIds]
    );
  }


  async findById(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<Profiles | null> {
    return (t ?? this.db).oneOrNone<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find profile by ID with JOINed permissions, role count, and creator name
   */
  async findByIdWithDetails(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<ProfileDetail | null> {
    const profile = await (t ?? this.db).oneOrNone<Profiles & {
      created_by_name: string | null;
      role_count: string;
    }>(
      `SELECT 
        p.*,
        CASE 
          WHEN u.id IS NOT NULL THEN TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
          ELSE NULL
        END AS created_by_name,
        (SELECT COUNT(*) FROM role_profiles rp WHERE rp.profile_id = p.id) AS role_count
      FROM ${this.tableName} p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`,
      [id]
    );

    if (!profile) return null;

    const permissions = await this.query<{
      id: string;
      action: string;
      effect: PermissionEffect;
      module_id: string;
      module_name: string;
      module_code: string;
    }>(
      `SELECT 
        perm.id,
        perm.action,
        pp.effect,
        perm.module_id,
        m.name AS module_name,
        m.code AS module_code
       FROM permissions perm
       INNER JOIN profile_permissions pp ON perm.id = pp.permission_id
       INNER JOIN modules m ON perm.module_id = m.id
       WHERE pp.profile_id = $1`,
      [id],
      t
    );

    return {
      id: profile.id,
      version: profile.version,
      name: profile.name,
      code: profile.code,
      description: profile.description ?? null,
      is_active: profile.is_active,
      permissions,
      role_count: parseInt(profile.role_count, 10),
      created_at: profile.created_at,
      created_by: profile.created_by ?? null,
      created_by_name: profile.created_by_name ?? null
    };
  }

  async findAllPaginated(
    t: ITask<unknown> | undefined,
    filters?: { is_active?: boolean; search?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Profiles>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

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

    const data = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName}
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, p.limit, offset],
      t
    );

    return buildPaginatedResult(data, parseInt(total.count, 10), p);
  }

  async create(
    t: ITask<unknown> | undefined,
    input: CreateProfileInput
  ): Promise<Profiles> {
    return (t ?? this.db).one<Profiles>(
      `INSERT INTO ${this.tableName} (name, code, description, is_active, created_by)
       VALUES ($1, $2, $3, COALESCE($4, true), $5)
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.is_active ?? null,
        input.created_by ?? null
      ]
    );
  }

  async update(
    t: ITask<unknown> | undefined,
    id: string,
    input: Profiles
  ): Promise<Profiles> {
    const row = await (t ?? this.db).oneOrNone<Profiles>(
      `UPDATE ${this.tableName}
       SET name = $2,
           code = $3,
           description = $4,
           is_active = $5,
           created_by = $6,
           updated_at = NOW(),
           version = version + 1
       WHERE id = $1 AND version = $7
       RETURNING *`,
      [
        id,
        input.name,
        input.code,
        input.description ?? null,
        input.is_active ?? null,
        input.created_by ?? null,
        input.version
      ]
    );

    if (!row) {
      throw new ConcurrentModificationError('Profile', id);
    }

    return row;
  }
}
