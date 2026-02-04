import { IDatabase, ITask } from 'pg-promise';
import { Modules } from '../models/modules.model';
import { CreateModuleInput } from '../types/repository.types';

export interface IModuleRepository {
  findAll(t?: ITask<unknown>): Promise<Modules[]>;
  findByCode(t: ITask<unknown> | undefined, code: string): Promise<Modules | null>;
  findById(t: ITask<unknown> | undefined, id: string): Promise<Modules | null>;
  create(t: ITask<unknown> | undefined, input: CreateModuleInput): Promise<Modules>;
  update(t: ITask<unknown> | undefined, id: string, input: Modules): Promise<Modules>;
  delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
}

export class ModuleRepository implements IModuleRepository {
  private tableName = 'modules';

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
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }

  async findByCode(
    t: ITask<unknown> | undefined,
    code: string
  ): Promise<Modules | null> {
    return (t ?? this.db).oneOrNone<Modules>(
      `SELECT * FROM ${this.tableName} WHERE code = $1`,
      [code]
    );
  }

  async findAll(t?: ITask<unknown>): Promise<Modules[]> {
    return this.query<Modules>(
      `SELECT * FROM ${this.tableName}`,
      [],
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
