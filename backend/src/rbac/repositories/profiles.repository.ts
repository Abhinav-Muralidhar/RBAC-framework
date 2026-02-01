import { Pool, QueryResultRow } from 'pg';
import { Profiles } from '../models/profiles.model';
import { ProfileListFilterDto, ProfileResponseDto } from '../dto/profile.dto';
import { PermissionEffect } from '../models/profile_permissions.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateProfileInput, UpdateProfileInput } from '../types/repository.types';

export interface IProfilesRepository {
  create(input: CreateProfileInput): Promise<Profiles>;
  update(id: string, input: UpdateProfileInput): Promise<Profiles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Profiles | null>;
  findByIdWithDetails(id: string): Promise<ProfileResponseDto | null>;
  findByIdIncludingInactive(id: string): Promise<Profiles | null>;
  findByCode(code: string): Promise<Profiles | null>;
  findAll(filters?: ProfileListFilterDto): Promise<Profiles[]>;
  findAllPaginated(filters?: ProfileListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Profiles>>;
  count(filters?: ProfileListFilterDto): Promise<number>;
  findActive(): Promise<Profiles[]>;
}

const ACTIVE_FILTER = `is_active = true`;

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
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find profile by ID with JOINed permissions (including module info), role count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<ProfileResponseDto | null> {
    // Get the profile with creator name and role count
    const profileRes = await this.query<Profiles & {
      created_by_name: string | null;
      role_count: string;
    }>(
      `SELECT 
        p.*,
        CASE 
          WHEN u.id IS NOT NULL THEN COALESCE(u.first_name, '') || ' ' || u.last_name
          ELSE NULL
        END AS created_by_name,
        (SELECT COUNT(*) FROM role_profiles rp WHERE rp.profile_id = p.id) AS role_count
      FROM ${this.tableName} p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1 AND p.${ACTIVE_FILTER}`,
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

  async findByCode(code: string): Promise<Profiles | null> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE code = $1 AND ${ACTIVE_FILTER}`,
      [code]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: ProfileListFilterDto): Promise<Profiles[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    sql += ` ORDER BY created_at DESC`;
    const res = await this.query<Profiles>(sql);
    return res.rows;
  }

  async findAllPaginated(
    filters?: ProfileListFilterDto,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Profiles>> {
    const normalizedPagination = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

    const total = await this.count(filters);

    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    sql += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

    const res = await this.query<Profiles>(sql, [normalizedPagination.limit, offset]);
    return buildPaginatedResult(res.rows, total, normalizedPagination);
  }

  async count(filters?: ProfileListFilterDto): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const res = await this.query<{ count: string }>(sql);
    return parseInt(res.rows[0]?.count ?? '0', 10);
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

  async update(id: string, input: UpdateProfileInput): Promise<Profiles> {
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
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Profile ${id} not found`);
      return existing;
    }

    const res = await this.query<Profiles>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1 AND ${ACTIVE_FILTER}
       RETURNING *`,
      values
    );
    if (res.rows.length === 0) throw new Error(`Profile ${id} not found for update`);
    return res.rows[0]!;
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  async findActive(): Promise<Profiles[]> {
    const res = await this.query<Profiles>(
      `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER} ORDER BY created_at DESC`
    );
    return res.rows;
  }
}
