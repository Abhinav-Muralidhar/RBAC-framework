import { Pool, QueryResultRow } from 'pg';
import { Groups } from '../models/groups.model';
import { GroupListFilterDto, GroupResponseDto } from '../dto/group.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export interface IGroupRepository {
  create(data: Partial<Groups>): Promise<Groups>;
  update(id: string, data: Partial<Groups>): Promise<Groups>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Groups | null>;
  findByIdWithDetails(id: string): Promise<GroupResponseDto | null>;
  findByIdIncludingInactive(id: string): Promise<Groups | null>;
  findAll(filters?: GroupListFilterDto): Promise<Groups[]>;
  findAllPaginated(filters?: GroupListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
  findByName(name: string): Promise<Groups | null>;
  count(filters?: GroupListFilterDto): Promise<number>;
  findActive(): Promise<Groups[]>;
  findInactive(): Promise<Groups[]>;
}

const ACTIVE_FILTER = `is_active = true`;

export class GroupRepository implements IGroupRepository {
  private tableName = 'groups';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<Groups | null> {
    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find group by ID with JOINed roles, user count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<GroupResponseDto | null> {
    // Get the group with creator name and user count
    const groupRes = await this.query<Groups & {
      created_by_name: string | null;
      user_count: string;
    }>(
      `SELECT 
        g.*,
        CASE 
          WHEN u.id IS NOT NULL THEN COALESCE(u.first_name, '') || ' ' || u.last_name
          ELSE NULL
        END AS created_by_name,
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS user_count
      FROM ${this.tableName} g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.id = $1 AND g.${ACTIVE_FILTER}`,
      [id]
    );

    const group = groupRes.rows[0];
    if (!group) return null;

    // Get assigned roles
    const rolesRes = await this.query<{ id: string; name: string; code: string }>(
      `SELECT r.id, r.name, r.code
       FROM roles r
       INNER JOIN group_roles gr ON r.id = gr.role_id
       WHERE gr.group_id = $1 AND r.is_active = true`,
      [id]
    );

    return {
      id: group.id,
      name: group.name,
      code: group.code,
      description: group.description ?? null,
      is_active: group.is_active,
      roles: rolesRes.rows,
      user_count: parseInt(group.user_count, 10),
      created_at: group.created_at,
      created_by: group.created_by ?? null,
      created_by_name: group.created_by_name ?? null
    };
  }

  async findByIdIncludingInactive(id: string): Promise<Groups | null> {
    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: GroupListFilterDto): Promise<Groups[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    sql += ` ORDER BY created_at DESC`;
    const res = await this.query<Groups>(sql);
    return res.rows;
  }

  async findAllPaginated(
    filters?: GroupListFilterDto,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Groups>> {
    const normalizedPagination = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

    const total = await this.count(filters);

    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    sql += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

    const res = await this.query<Groups>(sql, [normalizedPagination.limit, offset]);
    return buildPaginatedResult(res.rows, total, normalizedPagination);
  }

  async count(filters?: GroupListFilterDto): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const res = await this.query<{ count: string }>(sql);
    return parseInt(res.rows[0]?.count ?? '0', 10);
  }

  async findByName(name: string): Promise<Groups | null> {
    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE name = $1 AND ${ACTIVE_FILTER}`,
      [name]
    );
    return res.rows[0] ?? null;
  }

  async create(data: Partial<Groups>): Promise<Groups> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) throw new Error('Cannot create group with empty data');

    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Groups>(
      `INSERT INTO ${this.tableName} (${columns})
             VALUES (${placeholders})
             RETURNING *`,
      values
    );

    return res.rows[0]!;
  }

  async update(id: string, data: Partial<Groups>): Promise<Groups> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Group ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');

    const res = await this.query<Groups>(
      `UPDATE ${this.tableName}
             SET ${setClause}
             WHERE id = $1 AND ${ACTIVE_FILTER}
             RETURNING *`,
      [id, ...values]
    );

    if (res.rows.length === 0) throw new Error(`Group ${id} not found for update`);
    return res.rows[0]!;
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }

  async findActive(): Promise<Groups[]> {
    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER} ORDER BY created_at DESC`
    );
    return res.rows;
  }

  async findInactive(): Promise<Groups[]> {
    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE is_active = false ORDER BY created_at DESC`
    );
    return res.rows;
  }
}
