import { Pool, QueryResultRow } from 'pg';
import { IDatabase, ITask } from 'pg-promise';
import { Groups } from '../models/groups.model';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateGroupInput } from '../types/repository.types';

export interface IGroupRepository {
  create(input: CreateGroupInput): Promise<Groups>;
  update(id: string, input: Groups): Promise<Groups>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Groups | null>;
  findByIdWithDetails(id: string): Promise<GroupResponse | null>;
  findByName(name: string, isActive?: boolean, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>
  findAllPaginated(filters?: { isActive?: boolean, name?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
}
export interface GroupResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;

  // Assigned roles (JOINed with names)
  roles: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  users: Array<{
    id: string;
    name: string;
  }>;
  // User count in this group
  user_count?: number;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;  // JOINed: creator's name
}

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
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Find group by ID with JOINed roles, user count, and creator name
   */
  async findByIdWithDetails(id: string): Promise<GroupResponse | null> {
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
      WHERE g.id = $1`,
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
    const usersRes = await this.query<{ id: string; name: string; code: string }>(
      `SELECT u.id, u.username as name
       FROM users u
       INNER JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = $1 AND u.is_active = true`,
      [id]
    );

    return {
      id: group.id,
      name: group.name,
      code: group.code,
      description: group.description ?? null,
      is_active: group.is_active,
      roles: rolesRes.rows,
      users: usersRes.rows,
      user_count: parseInt(group.user_count, 10),
      created_at: group.created_at,
      created_by: group.created_by ?? null,
      created_by_name: group.created_by_name ?? null
    };
  }

  async findByName(name: string, isActive?: boolean, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}
     WHERE name LIKE $1 AND is_active = $2`,
      [`%${name}%`, isActive ?? true]
    );

    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName}
     WHERE name LIKE $1 AND is_active = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
      [`%${name}%`, isActive ?? true, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }


  async create(input: CreateGroupInput): Promise<Groups> {
    const res = await this.query<Groups>(
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
    if (!res.rows[0]) throw new Error('Group creation failed');
    return res.rows[0];
  }

  async update(id: string, input: Groups): Promise<Groups> {
    const values = [
      input.name,
      input.code,
      input.description ?? null,
      input.is_active ?? null,
      id
    ];
    const res = await this.query<Groups>(
      `UPDATE ${this.tableName}
       SET name = $1, code = $2, description = $3, is_active = $4
       WHERE id = $5 AND is_active = $6
       RETURNING *`,
      values
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

  async findAllPaginated(
    filters?: { isActive?: boolean, name?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Groups>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} WHERE is_active = $1`,
      [filters?.isActive ?? true]
    );
    let wher = '';
    if (filters?.name) {
      wher = `where name like %${filters.name}%`;
    }

    const res = await this.query<Groups>(
      `SELECT * FROM ${this.tableName}
      ${wher}
     WHERE is_active = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
      [filters?.isActive ?? true, p.limit, offset]
    );

    return buildPaginatedResult(
      res.rows,
      parseInt(totalRes.rows[0]?.count ?? '0', 10),
      p
    );
  }

}
