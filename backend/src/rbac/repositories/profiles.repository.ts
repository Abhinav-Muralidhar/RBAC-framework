import { Pool, QueryResultRow } from 'pg';
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

export interface ProfileDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;

  // Assigned permissions (JOINed with module info)
  permissions: Array<{
    id: string;
    action: string;              // e.g., 'read', 'create', 'update', 'delete'
    effect: PermissionEffect;    // 'allow' or 'deny'
    module_id: string;
    module_name: string;         // JOINed: modules.name
    module_code: string;         // JOINed: modules.code
  }>;

  role_count?: number;

  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
}

export interface IProfilesRepository {
  create(input: CreateProfileInput): Promise<Profiles>;
  update(id: string, input: Profiles): Promise<Profiles>;
  findById(id: string): Promise<Profiles | null>;
  findByIdWithDetails(id: string): Promise<ProfileDetail | null>;
  findAllPaginated(filters?: { is_active?: boolean, search?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Profiles>>;
}

export class ProfilesRepository implements IProfilesRepository {
  private tableName = 'profiles';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Profiles | null> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find profile by ID with JOINed permissions (including module info), role count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<ProfileDetail | null> {
    // Get the profile with creator name and role count
    const profileRes = await this.query<Profiles & {
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

    const profile = profileRes.rows[0];
    if (!profile) return null;

    // Get assigned permissions with module info
    const permissionsRes = await this.query<{
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
      [id]
    );

    return {
      id: profile.id,
      name: profile.name,
      code: profile.code,
      description: profile.description ?? null,
      is_active: profile.is_active,
      permissions: permissionsRes.rows,
      role_count: parseInt(profile.role_count, 10),
      created_at: profile.created_at,
      created_by: profile.created_by ?? null,
      created_by_name: profile.created_by_name ?? null
    };
  }

  async findByIdIncludingInactive(id: string): Promise<Profiles | null> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAllPaginated(
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

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      values
    );
    const total = parseInt(totalRes.rows[0]?.count ?? '0', 10);
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName}
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, p.limit, offset]
    );

    return buildPaginatedResult(res.rows, total, p);
  }

  async create(input: CreateProfileInput): Promise<Profiles> {
    const res = await this.query<Profiles>(
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
    if (!res.rows[0]) throw new Error('Profile creation failed');
    return res.rows[0];
  }

  async update(id: string, input: Profiles): Promise<Profiles> {
    const values = [
      id,
      input.name,
      input.code,
      input.description ?? null,
      input.is_active ?? null,
      input.created_by ?? null
    ];
    const res = await this.query<Profiles>(
      `UPDATE ${this.tableName}
       SET name = $2, code = $3, description = $4, is_active = $5, created_by = $6
       WHERE id = $1
       RETURNING *`,
      values
    );
    if (res.rows.length === 0) throw new Error(`Profile ${id} not found for update`);
    return res.rows[0]!;
  }
}
