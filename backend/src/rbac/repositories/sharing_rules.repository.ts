import { IDatabase, ITask } from 'pg-promise';
import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { CreateSharingRuleInput, UpdateSharingRuleInput } from '../types/repository.types';
import { buildPaginatedResult, getPaginationOffset, normalizePaginationParams, PaginatedResult, PaginationParams } from '../utils/pagination.utils';

export interface ISharingRulesRepository {
  create(t: ITask<unknown> | undefined, input: CreateSharingRuleInput): Promise<SharingRules>;
  update(t: ITask<unknown> | undefined, id: string, input: UpdateSharingRuleInput): Promise<SharingRules>;
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
  findById(t: ITask<unknown> | undefined, id: string): Promise<SharingRules | null>;
  findAll(t?: ITask<unknown>, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
  findByType(t: ITask<unknown> | undefined, type: SharingRuleType): Promise<SharingRules[]>;
  findByModule(t: ITask<unknown> | undefined, moduleId: string): Promise<SharingRules[]>;
}

const ACTIVE_FILTER = `is_active = true`;

interface SharingRuleDetail extends SharingRules {
  module_name: string,
}

export class SharingRulesRepository implements ISharingRulesRepository {
  private tableName = 'sharing_rules';

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
  ): Promise<SharingRules | null> {
    return (t ?? this.db).oneOrNone<SharingRules>(
      `SELECT * FROM ${this.tableName}
       WHERE id = $1`,
      [id]
    );
  }

  async findAll(t?: ITask<unknown>, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRuleDetail>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const total = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`,
      []
    );
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (filters?.is_active !== undefined) {
      whereClauses.push(`sr.is_active = $${paramIndex}`);
      queryParams.push(filters.is_active);
      paramIndex++;
    }
    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const items = await (t ?? this.db).any<SharingRuleDetail>(
      `SELECT sr.*,m.module_name
       FROM ${this.tableName} sr
       INNER JOIN modules m ON m.id = sr.module_id
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, p.limit, offset]
    );
    return buildPaginatedResult(items, parseInt(total.count, 10), p);
  }

  async findByType(
    t: ITask<unknown> | undefined,
    type: SharingRuleType
  ): Promise<SharingRules[]> {
    return this.query<SharingRules>(
      `SELECT *
       FROM ${this.tableName}
       WHERE rule_type = $1
       AND ${ACTIVE_FILTER}`,
      [type],
      t
    );
  }

  async findByModule(
    t: ITask<unknown> | undefined,
    moduleId: string
  ): Promise<SharingRules[]> {
    return this.query<SharingRules>(
      `SELECT *
       FROM ${this.tableName}
       WHERE module_id = $1
       AND is_active = true`,
      [moduleId],
      t
    );
  }

  async create(
    t: ITask<unknown> | undefined,
    input: CreateSharingRuleInput
  ): Promise<SharingRules> {
    return (t ?? this.db).one<SharingRules>(
      `INSERT INTO ${this.tableName}
       (rule_type, module_id, is_active, created_by)
       VALUES ($1, $2, COALESCE($3, true), $4)
       RETURNING *`,
      [
        input.rule_type,
        input.module_id,
        input.is_active ?? null,
        input.created_by ?? null
      ]
    );
  }

  async update(
    t: ITask<unknown> | undefined,
    id: string,
    input: UpdateSharingRuleInput
  ): Promise<SharingRules> {
    const res = await (t ?? this.db).oneOrNone<SharingRules>(
      `UPDATE ${this.tableName}
       SET rule_type = $1,
           is_active = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        input.rule_type,
        input.is_active ?? null,
        id
      ]
    );

    if (!res) throw new Error(`SharingRules ${id} not found`);
    return res;
  }

  async delete(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<void> {
    await (t ?? this.db).none(
      `UPDATE ${this.tableName}
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }
}
