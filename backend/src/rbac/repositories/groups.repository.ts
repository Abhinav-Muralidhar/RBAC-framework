import { IDatabase, ITask } from 'pg-promise';
import { Groups } from '../models/groups.model';
import { TransactionTask } from '../utils/transaction.utils';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateGroupInput } from '../types/repository.types';

export interface IGroupRepository {
  create(t: TransactionTask, input: CreateGroupInput): Promise<Groups>;
  update(t: TransactionTask, id: string, input: Groups): Promise<Groups>;
  delete(t: TransactionTask, id: string): Promise<void>;
  findById(t: TransactionTask, id: string): Promise<Groups | null>;
  findByIdWithDetails(t: TransactionTask, id: string): Promise<GroupResponse | null>;
  findByName(t: TransactionTask, name: string, isActive?: boolean): Promise<PaginatedResult<Groups>>;
  findByCode(t: TransactionTask, code: string, isActive?: boolean): Promise<boolean>;
  findAllPaginated(t: TransactionTask, filters?: { isActive?: boolean; name?: string, code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Groups>>;
}

export interface GroupResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  roles: Array<{ id: string; name: string; code: string }>;
  users: Array<{ id: string; name: string }>;
  user_count?: number;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
}

export class GroupRepository implements IGroupRepository {
  private tableName = 'groups';

  constructor(private db: IDatabase<unknown>) { }

  protected async query<T>(text: string, params?: unknown[], t?: ITask<unknown>): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findById(t: TransactionTask, id: string): Promise<Groups | null> {
    const rows = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
      t
    );
    return rows[0] ?? null;
  }

  async findByCode(t: TransactionTask, code: string, isActive = true): Promise<boolean> {
    const rows = await this.query<Groups>(
      `SELECT * FROM ${this.tableName} WHERE code = $1 AND is_active = $2`,
      [code, isActive],
      t
    );
    return rows.length > 0;
  }


  async findByIdWithDetails(t: TransactionTask, id: string): Promise<GroupResponse | null> {
    const groupRes = await this.query<
      Groups & { created_by_name: string | null; user_count: string }
    >(
      `SELECT
         g.*,
         CASE
           WHEN u.id IS NOT NULL
           THEN COALESCE(u.first_name, '') || ' ' || u.last_name
           ELSE NULL
         END AS created_by_name,
         (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS user_count
       FROM ${this.tableName} g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = $1`,
      [id],
      t
    );

    const group = groupRes[0];
    if (!group) return null;

    const roles = await this.query<{ id: string; name: string; code: string }>(
      `SELECT r.id, r.name, r.code
       FROM roles r
       INNER JOIN group_roles gr ON r.id = gr.role_id
       WHERE gr.group_id = $1 AND r.is_active = true`,
      [id],
      t
    );

    const users = await this.query<{ id: string; name: string }>(
      `SELECT u.id, u.username AS name
       FROM users u
       INNER JOIN user_groups ug ON u.id = ug.user_id
       WHERE ug.group_id = $1 AND u.is_active = true`,
      [id],
      t
    );

    return {
      id: group.id,
      name: group.name,
      code: group.code,
      description: group.description ?? null,
      is_active: group.is_active,
      roles,
      users,
      user_count: parseInt(group.user_count, 10),
      created_at: group.created_at,
      created_by: group.created_by ?? null,
      created_by_name: group.created_by_name ?? null
    };
  }

  async findByName(
    t: TransactionTask,
    name: string,
    isActive = true,
    pagination?: Partial<PaginationParams>,
  ): Promise<PaginatedResult<Groups>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const params: unknown[] = [`%${name}%`, isActive];

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM ${this.tableName}
       WHERE name ILIKE $1 AND is_active = $2`,
      params,
      t
    );

    params.push(p.limit, offset);

    const res = await this.query<Groups>(
      `SELECT *
       FROM ${this.tableName}
       WHERE name ILIKE $1 AND is_active = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      params,
      t
    );

    return buildPaginatedResult(
      res,
      parseInt(totalRes[0]?.count ?? '0', 10),
      p
    );
  }


  async create(t: TransactionTask, input: CreateGroupInput): Promise<Groups> {
    return (t ?? this.db).one<Groups>(
      `INSERT INTO ${this.tableName}
       (name, code, description, is_active, created_by)
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

  async update(t: TransactionTask, id: string, input: Groups): Promise<Groups> {
    const row = await (t ?? this.db).oneOrNone<Groups>(
      `UPDATE ${this.tableName}
       SET name = $1,
           code = $2,
           description = $3,
           is_active = $4
       WHERE id = $5
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.is_active ?? null,
        id
      ]
    );

    if (!row) {
      throw new Error(`Group ${id} not found for update`);
    }

    return row;
  }

  async delete(t: TransactionTask, id: string): Promise<void> {
    await (t ?? this.db).none(
      `UPDATE ${this.tableName}
       SET is_active = false
       WHERE id = $1`,
      [id]
    );
  }

  async findAllPaginated(
    t: TransactionTask,
    filters?: { isActive?: boolean; name?: string; code?: string },
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<Groups>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);

    const params: unknown[] = [];
    const where: string[] = [];

    // isActive (default true)
    params.push(filters?.isActive ?? true);
    where.push(`is_active = $${params.length}`);

    if (filters?.name) {
      params.push(`%${filters.name}%`);
      where.push(`name ILIKE $${params.length}`);
    }

    if (filters?.code) {
      params.push(`%${filters.code}%`);
      where.push(`code ILIKE $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`,
      params,
      t
    );

    params.push(p.limit, offset);

    const res = await this.query<Groups>(
      `SELECT *
     FROM ${this.tableName}
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
      params,
      t
    );

    return buildPaginatedResult(
      res,
      parseInt(totalRes[0]?.count ?? '0', 10),
      p
    );
  }
}
