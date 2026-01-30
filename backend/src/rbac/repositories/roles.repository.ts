import { Pool, QueryResultRow } from 'pg';
import { Roles } from '../models/roles.model';
import { RoleListFilterDto } from '../dto/role.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export interface IRoleRepository {
  create(data: Partial<Roles>): Promise<Roles>;
  update(id: string, data: Partial<Roles>): Promise<Roles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Roles | null>;
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

  async create(data: Partial<Roles>): Promise<Roles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const res = await this.query<Roles>(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return res.rows[0]!;
  }

  async update(id: string, data: Partial<Roles>): Promise<Roles> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Role ${id} not found`);
      return existing;
    }

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const res = await this.query<Roles>(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 AND ${ACTIVE_FILTER} RETURNING *`,
      [id, ...values]
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
