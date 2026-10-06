import { IDatabase, ITask } from 'pg-promise';
import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
import { CreateSharingRuleInput, UpdateSharingRuleInput } from '../types/repository.types';
import { buildPaginatedResult, getPaginationOffset, normalizePaginationParams, PaginatedResult, PaginationParams } from '../../utils/pagination.utils';
import { ConcurrentModificationError } from '../errors/rbac.errors';

export interface ISharingRulesRepository {
  /** Insert a new sharing rule row. */
  create(t: ITask<unknown> | undefined, input: CreateSharingRuleInput): Promise<SharingRules>;
  /** Update a sharing rule's attributes (type, status). */
  update(t: ITask<unknown> | undefined, id: string, input: UpdateSharingRuleInput): Promise<SharingRules>;
  /** Hard-delete a sharing rule. */
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
  /** Fetch a sharing rule by primary key. */
  findById(t: ITask<unknown> | undefined, id: string): Promise<SharingRules | null>;
  /** Fetch sharing rule with JOINed module info and audit names. */
  findByIdWithDetails(t: ITask<unknown> | undefined, id: string): Promise<(SharingRules & { module_name: string; created_by_name: string | null; updated_by_name: string | null }) | null>;
  /** List all sharing rules with optional active filter and pagination. */
  findAll(t?: ITask<unknown>, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
  /** Fetch sharing rules filtered by type (Public/Private). */
  findByType(t: ITask<unknown> | undefined, type: SharingRuleType): Promise<SharingRules[]>;
  /** Fetch sharing rules associated with a specific module. */
  findByModule(t: ITask<unknown> | undefined, moduleId: string): Promise<SharingRules[]>;
}

const ACTIVE_FILTER = `is_active = true`;

interface SharingRuleDetail extends SharingRules {
  module_name: string,
}

export class SharingRulesRepository implements ISharingRulesRepository {
  private tableName = 'sharing_rules';
  private readonly baseColumns = 'id, version, rule_type, module_id, is_active, created_at, created_by, updated_at, updated_by';

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
      `SELECT ${this.baseColumns} FROM ${this.tableName}
       WHERE id = $1`,
      [id]
    );
  }

  async findByIdWithDetails(
    t: ITask<unknown> | undefined,
    id: string,
  ): Promise<(SharingRules & { module_name: string; created_by_name: string | null; updated_by_name: string | null }) | null> {
    return (t ?? this.db).oneOrNone<SharingRules & { module_name: string; created_by_name: string | null; updated_by_name: string | null }>(
      `SELECT sr.id, sr.version, sr.rule_type, sr.module_id, sr.is_active,
              sr.created_at, sr.created_by, sr.updated_at, sr.updated_by,
              m.name AS module_name,
              CASE
                WHEN c.id IS NOT NULL THEN c.username
                ELSE NULL
              END AS created_by_name,
              CASE
                WHEN ub.id IS NOT NULL THEN ub.username
                ELSE NULL
              END AS updated_by_name
       FROM ${this.tableName} sr
       LEFT JOIN modules m ON sr.module_id = m.id
       LEFT JOIN users c ON sr.created_by = c.id
       LEFT JOIN users ub ON sr.updated_by = ub.id
       WHERE sr.id = $1`,
      [id]
    );
  }

  async findAll(t?: ITask<unknown>, filters?: { is_active?: boolean }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRuleDetail>> {
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (filters?.is_active !== undefined) {
      whereClauses.push(`sr.is_active = $${paramIndex}`);
      queryParams.push(filters.is_active);
      paramIndex++;
    }
    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const total = await (t ?? this.db).one<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName} sr ${whereClause}`,
      queryParams
    );

    const items = await (t ?? this.db).any<SharingRuleDetail>(
      `SELECT sr.id, sr.version, sr.rule_type, sr.module_id, sr.is_active, sr.created_at, sr.created_by, sr.updated_at, sr.updated_by, m.name AS module_name
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
      `SELECT ${this.baseColumns}
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
      `SELECT ${this.baseColumns}
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
       (rule_type, module_id, is_active, created_by,updated_by,updated_at)
       VALUES ($1, $2, COALESCE($3, true), $4,$5,NOW())
       RETURNING *`,
      [
        input.rule_type,
        input.module_id,
        input.is_active ?? null,
        input.created_by ?? null,
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
           updated_at = NOW(),
           updated_by = $3,
           version = version + 1
       WHERE id = $4 AND version = $5
       RETURNING *`,
      [
        input.rule_type,
        input.is_active ?? null,
        input.updated_by ?? null,
        id,
        input.version
      ]
    );

    if (!res) throw new ConcurrentModificationError('SharingRule', id);
    return res;
  }

  async delete(
    t: ITask<unknown> | undefined,
    id: string
  ): Promise<void> {
    await (t ?? this.db).none(
      `UPDATE ${this.tableName}
       SET is_active = false
       WHERE id = $1`,
      [id]
    );
  }
}
