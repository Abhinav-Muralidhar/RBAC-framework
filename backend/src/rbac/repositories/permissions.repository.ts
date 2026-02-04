import { IDatabase, ITask } from 'pg-promise';
import { Permissions, PermissionAction } from '../models/permissions.model';
import { CreatePermissionInput } from '../types/repository.types';
import { PermissionEffect } from '../models/profile_permissions.model';

export interface IPermissionsRepository {
    findById(t: ITask<unknown> | undefined, id: string): Promise<Permissions | null>;
    findAll(t: ITask<unknown> | undefined, filters?: { module_id?: string; action?: PermissionAction; }): Promise<Permissions[]>;
    findByModuleAndAction(t: ITask<unknown> | undefined, moduleId: string, action: PermissionAction): Promise<Permissions | null>;
    create(t: ITask<unknown> | undefined, input: CreatePermissionInput): Promise<Permissions>;
    update(t: ITask<unknown> | undefined, id: string, input: Permissions): Promise<Permissions>;
    delete(t: ITask<unknown> | undefined, id: string): Promise<void>;
    findEffectsByUserAndModuleAction(t: ITask<unknown> | undefined, userId: string, moduleCode: string, action: PermissionAction): Promise<PermissionEffect[]>;
    findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<{ id: string }[]>
}

export class PermissionsRepository implements IPermissionsRepository {
    private tableName = 'permissions';

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
    ): Promise<Permissions | null> {
        return (t ?? this.db).oneOrNone<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
    }

    async findAll(t: ITask<unknown> | undefined, filters?: { module_id?: string; action?: PermissionAction }): Promise<Permissions[]> {
        const where: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        if (filters?.module_id) {
            where.push(`module_id = $${paramIdx++}`);
            params.push(filters.module_id);
        }

        if (filters?.action) {
            where.push(`action = $${paramIdx++}`);
            params.push(filters.action);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        return this.query<Permissions>(
            `SELECT * FROM ${this.tableName} ${whereClause}`,
            params,
            t
        );
    }

    async findByModuleAndAction(
        t: ITask<unknown> | undefined,
        moduleId: string,
        action: PermissionAction
    ): Promise<Permissions | null> {
        return (t ?? this.db).oneOrNone<Permissions>(
            `SELECT * FROM ${this.tableName} WHERE module_id = $1 AND action = $2`,
            [moduleId, action]
        );
    }

    async findByIds(
        t: ITask<unknown> | undefined,
        ids: string[]
    ): Promise<{ id: string }[]> {
        return (t ?? this.db).any(
            `SELECT id FROM ${this.tableName} WHERE id = ANY($1)`,
            [ids]
        );
    }

    /**
     * OPTIMIZED PERMISSION CHECK
     */
    async findEffectsByUserAndModuleAction(
        t: ITask<unknown> | undefined,
        userId: string,
        moduleCode: string,
        action: PermissionAction
    ): Promise<PermissionEffect[]> {
        const rows = await this.query<{ effect: PermissionEffect }>(
            `
            SELECT DISTINCT pp.effect
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN role_profiles rp ON rp.role_id = ur.role_id
            JOIN profiles po ON po.id = rp.profile_id
            JOIN profile_permissions pp ON pp.profile_id = po.id
            JOIN permissions p ON p.id = pp.permission_id
            JOIN modules m ON m.id = p.module_id
            WHERE u.id = $1
              AND u.status NOT IN ('deleted', 'inactive')
              AND po.is_active = true
              AND m.code = $2
              AND p.action = $3
            `,
            [userId, moduleCode, action],
            t
        );

        return rows.map(r => r.effect);
    }

    async create(
        t: ITask<unknown> | undefined,
        input: CreatePermissionInput
    ): Promise<Permissions> {
        return (t ?? this.db).one<Permissions>(
            `INSERT INTO ${this.tableName} (action, module_id, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [input.action, input.module_id, input.description ?? null]
        );
    }

    async update(
        t: ITask<unknown> | undefined,
        id: string,
        input: Permissions
    ): Promise<Permissions> {
        return (t ?? this.db).one<Permissions>(
            `UPDATE ${this.tableName}
             SET action = $2,
                 description = $3
             WHERE id = $1
             RETURNING *`,
            [id, input.action, input.description ?? null]
        );
    }

    async delete(
        t: ITask<unknown> | undefined,
        id: string
    ): Promise<void> {
        await (t ?? this.db).none(
            `UPDATE ${this.tableName} SET is_active = false WHERE id = $1`,
            [id]
        );
    }
}
