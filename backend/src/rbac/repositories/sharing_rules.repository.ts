import { Pool, QueryResultRow } from 'pg';
import { SharingRules, SharingRuleType } from '../models/sharing_rules.model';
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
  findAllPaginated(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>>;
  findByType(type: SharingRuleType): Promise<SharingRules[]>;
  findByModule(moduleId: string): Promise<SharingRules[]>;

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

  async findById(id: string, isActive?: boolean): Promise<SharingRules | null> {
    const res = await this.query<SharingRules>(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = $2`,
      [id, isActive]
    );
    return res.rows[0] ?? null;
  }

  async findAllPaginated(pagination?: Partial<PaginationParams>): Promise<PaginatedResult<SharingRules>> {
    // 1. Normalize pagination
    const p = normalizePaginationParams(pagination);
    const offset = getPaginationOffset(p.page, p.limit);
    // 2. Get total count
    const totalRes = await this.query<{ count: string }>(
      `SELECT COUNT(*) FROM ${this.tableName}`
    );
    const total = parseInt(totalRes.rows[0]?.count ?? '0', 10);
    // 3. Fetch paginated data
    const res = await this.query<SharingRules>(
      `SELECT *
     FROM ${this.tableName}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
      [p.limit, offset]
    );
    // 4. Build paginated result
    return buildPaginatedResult(res.rows, total, p);
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
      `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND is_active = true`,
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

  async update(id: string, input: SharingRules): Promise<SharingRules> {
    const values = [
      input.rule_type,
      input.module_id,
      input.is_active ?? null,
      id
    ]
    const res = await this.query<SharingRules>(
      `UPDATE ${this.tableName} SET rule_type = $1, is_active = $3 WHERE id = $4 AND module_id = $2 RETURNING *`,
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
