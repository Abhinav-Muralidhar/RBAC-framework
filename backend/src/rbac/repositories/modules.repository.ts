import { IDatabase, ITask } from 'pg-promise';
import { Modules } from '../models/modules.model';
import { CreateModuleInput } from '../types/repository.types';

export interface IModuleRepository {
  /** List all modules with optional code array or active status filters. */
  findAll(t?: ITask<unknown>, filters?: { codes?: string[]; is_active?: boolean }): Promise<Modules[]>;
  /** Fetch a single module by its unique system code. */
  findByCode(t: ITask<unknown> | undefined, code: string): Promise<Modules | null>;
  /** Fetch a single module by its primary key. */
  findById(t: ITask<unknown> | undefined, id: string): Promise<Modules | null>;
  /** Fetch multiple modules by primary key. */
  findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<Modules[]>;
  /** Insert a new module registration. */
  create(t: ITask<unknown> | undefined, input: CreateModuleInput): Promise<Modules>;
  /** Update an existing module metadata. */
  update(t: ITask<unknown> | undefined, id: string, input: Modules): Promise<Modules>;
  /** Soft-delete a module by marking it inactive. */
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
}

export class ModuleRepository implements IModuleRepository {
  private tableName = 'modules';
  private readonly baseColumns = 'id, name, code, description, is_active, sort_order';

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
    id: string
  ): Promise<Modules | null> {
    return (t ?? this.db).oneOrNone<Modules>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }

  async findByIds(
    t: ITask<unknown> | undefined,
    ids: string[]
  ): Promise<Modules[]> {
    if (!ids.length) {
      return [];
    }

    return (t ?? this.db).any<Modules>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE id = ANY($1::bigint[])`,
      [ids.map((id) => BigInt(id))]
    );
  }

  async findByCode(
    t: ITask<unknown> | undefined,
    code: string
  ): Promise<Modules | null> {
    return (t ?? this.db).oneOrNone<Modules>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
  }

  async findAll(t?: ITask<unknown>, filters?: { codes?: string[]; is_active?: boolean }): Promise<Modules[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.codes?.length) {
      where.push(`code = ANY($${paramIdx++})`);
      params.push(filters.codes);
    }

    if (filters?.is_active !== undefined) {
      where.push(`is_active = $${paramIdx++}`);
      params.push(filters.is_active);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return this.query<Modules>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} ${whereClause}`,
      params,
      t
    );
  }

  async create(
    t: ITask<unknown> | undefined,
    input: CreateModuleInput
  ): Promise<Modules> {
    return (t ?? this.db).one<Modules>(
      `INSERT INTO ${this.tableName} (name, code, description, is_active)
       VALUES ($1, $2, $3, COALESCE($4, true))
       RETURNING *`,
      [
        input.name,
        input.code,
        input.description ?? null,
        input.is_active ?? null
      ]
    );
  }

  async update(
    t: ITask<unknown> | undefined,
    id: string,
    input: Modules
  ): Promise<Modules> {
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

    if (!updates.length) {
      const existing = await this.findById(t, id);
      if (!existing) throw new Error(`Module ${id} not found`);
      return existing;
    }

    updates.push('updated_at = NOW()');

    return (t ?? this.db).one<Modules>(
      `UPDATE ${this.tableName}
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );
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
