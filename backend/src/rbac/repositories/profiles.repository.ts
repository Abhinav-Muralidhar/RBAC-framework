import { Pool, QueryResultRow } from 'pg';
import { Profiles } from '../models/profiles.model';
import { ProfileListFilterDto } from '../dto/profile.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';

export interface IProfilesRepository {
  create(data: Partial<Profiles>): Promise<Profiles>;
  update(id: string, data: Partial<Profiles>): Promise<Profiles>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Profiles | null>;
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

  async create(data: Partial<Profiles>): Promise<Profiles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const indices = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(',');

    const query = `
            INSERT INTO ${this.tableName} (${columns})
            VALUES (${indices})
            RETURNING *
        `;
    const res = await this.query<Profiles>(query, values);
    return res.rows[0]!;
  }

  async update(id: string, data: Partial<Profiles>): Promise<Profiles> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    if (keys.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Profile ${id} not found`);
      return existing;
    }

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const query = `
            UPDATE ${this.tableName}
            SET ${setClause}
            WHERE id = $1 AND ${ACTIVE_FILTER}
            RETURNING *
        `;
    const res = await this.query<Profiles>(query, [id, ...values]);
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
