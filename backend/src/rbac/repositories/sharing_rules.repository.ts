import { Pool, QueryResultRow } from 'pg';
import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { SharingRuleListFilterDto } from '../dto/sharing-rule.dto';
import {
  PaginationParams,
  PaginatedResult,
  normalizePaginationParams,
  getPaginationOffset,
  buildPaginatedResult
} from '../utils/pagination.utils';
import { CreateSharingRuleInput, UpdateSharingRuleInput } from '../types/repository.types';

export interface ISharingRulesRepository {
  create(input: CreateSharingRuleInput): Promise<SharingRules>;
  update(id: string, input: UpdateSharingRuleInput): Promise<SharingRules>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<SharingRules | null>;
  findByIdIncludingInactive(id: string): Promise<SharingRules | null>;
  findAll(filters?: SharingRuleListFilterDto): Promise<SharingRules[]>;
  findAllPaginated(filters?: SharingRuleListFilterDto, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
  findActive(): Promise<SharingRules[]>;
  findByType(type: SharingRuleType): Promise<SharingRules[]>;
  findByModule(moduleId: string): Promise<SharingRules[]>;
  count(filters?: SharingRuleListFilterDto): Promise<number>;
}

const ACTIVE_FILTER = `is_active = true`;

export class SharingRulesRepository implements ISharingRulesRepository {
  private tableName = 'sharing_rules';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findById(id: string): Promise<SharingRules | null> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND ${ACTIVE_FILTER}`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findByIdIncludingInactive(id: string): Promise<SharingRules | null> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findAll(filters?: SharingRuleListFilterDto): Promise<SharingRules[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.rule_type) {
        params.push(filters.rule_type);
        sql += ` AND rule_type = $${paramIndex++}`;
      }
      if (filters.module_id) {
        params.push(filters.module_id);
        sql += ` AND module_id = $${paramIndex++}`;
      }
    }

    sql += ` ORDER BY created_at DESC`;
    const res = await this.query<SharingRules>(sql, params);
    return res.rows;
  }

  async findAllPaginated(
    filters?: SharingRuleListFilterDto,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<SharingRules>> {
    const normalizedPagination = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(normalizedPagination.page, normalizedPagination.limit);

    const total = await this.count(filters);

    let sql = `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.rule_type) {
      params.push(filters.rule_type);
      sql += ` AND rule_type = $${paramIndex++}`;
    }
    if (filters?.module_id) {
      params.push(filters.module_id);
      sql += ` AND module_id = $${paramIndex++}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(normalizedPagination.limit, offset);

    const res = await this.query<SharingRules>(sql, params);
    return buildPaginatedResult(res.rows, total, normalizedPagination);
  }

  async count(filters?: SharingRuleListFilterDto): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${ACTIVE_FILTER}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.rule_type) {
      params.push(filters.rule_type);
      sql += ` AND rule_type = $${paramIndex++}`;
    }
    if (filters?.module_id) {
      params.push(filters.module_id);
      sql += ` AND module_id = $${paramIndex++}`;
    }

    const res = await this.query<{ count: string }>(sql, params);
    return parseInt(res.rows[0]?.count ?? '0', 10);
  }

  async findActive(): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE ${ACTIVE_FILTER} ORDER BY created_at DESC`
    );
    return res.rows;
  }

  async findByType(type: SharingRuleType): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE rule_type = $1 AND ${ACTIVE_FILTER}`,
      [type]
    );
    return res.rows;
  }

  async findByModule(moduleId: string): Promise<SharingRules[]> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND ${ACTIVE_FILTER}`,
      [moduleId]
    );
    return res.rows;
  }

  async create(input: CreateSharingRuleInput): Promise<SharingRules> {
    const res = await this.query<SharingRules>(
      `INSERT INTO ${this.tableName} (rule_type, module_id, is_active, created_by)
       VALUES ($1, $2, COALESCE($3, true), $4)
       RETURNING *`,
      [
        input.rule_type,
        input.module_id,
        input.is_active ?? null,
        input.created_by ?? null
      ]
    );
    if (!res.rows[0]) throw new Error('Sharing rule creation failed');
    return res.rows[0];
  }

  async update(id: string, input: UpdateSharingRuleInput): Promise<SharingRules> {
    const updates: string[] = [];
    const values: unknown[] = [id];
    let paramIdx = 2;

    if (input.rule_type !== undefined) {
      updates.push(`rule_type = $${paramIdx++}`);
      values.push(input.rule_type);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`SharingRules ${id} not found`);
      return existing;
    }

    const res = await this.query<SharingRules>(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = $1 AND ${ACTIVE_FILTER} RETURNING *`,
      values
    );

    if (!res.rows[0]) throw new Error(`SharingRules ${id} not found`);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query(
      `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
      [id]
    );
  }
}
