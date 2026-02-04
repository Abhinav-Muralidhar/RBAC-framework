import { IDatabase, ITask } from 'pg-promise';
import { ProfilePermissions, PermissionEffect } from '../models/profile_permissions.model';

export interface IProfilePermissionsRepository {
    findPermissionsByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<ProfilePermissions[]>;
    findProfilesByPermission(t: ITask<unknown> | undefined, permissionId: string): Promise<ProfilePermissions[]>;
    findAssignment(t: ITask<unknown> | undefined, profileId: string, permissionId: string): Promise<ProfilePermissions | null>;
    assign(t: ITask<unknown> | undefined, profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    updateEffect(t: ITask<unknown> | undefined, profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    revoke(t: ITask<unknown> | undefined, profileId: string, permissionId: string): Promise<void>;
    revokeAllByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<void>;
    replacePermissions(t: ITask<unknown> | undefined, profileId: string, permissionIds: string[]): Promise<void>;
    batchAssign(t: ITask<unknown> | undefined, profileId: string, permissionIds: string[]): Promise<void>;
    getPermissionIdsByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<string[]>;
}

export class ProfilePermissionsRepository implements IProfilePermissionsRepository {
    private tableName = 'profile_permissions';

    constructor(private db: IDatabase<unknown>) { }

    protected query<T>(
        text: string,
        params?: unknown[],
        t?: ITask<unknown>
    ): Promise<T[]> {
        return (t ?? this.db).any<T>(text, params);
    }

    async findPermissionsByProfile(
        t: ITask<unknown> | undefined,
        profileId: string
    ): Promise<ProfilePermissions[]> {
        return this.query<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId],
            t
        );
    }

    async findProfilesByPermission(
        t: ITask<unknown> | undefined,
        permissionId: string
    ): Promise<ProfilePermissions[]> {
        return this.query<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE permission_id = $1`,
            [permissionId],
            t
        );
    }

    async findAssignment(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionId: string
    ): Promise<ProfilePermissions | null> {
        return (t ?? this.db).oneOrNone<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`,
            [profileId, permissionId]
        );
    }

    async assign(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionId: string,
        effect: PermissionEffect
    ): Promise<ProfilePermissions> {
        return (t ?? this.db).one<ProfilePermissions>(
            `INSERT INTO ${this.tableName} (profile_id, permission_id, effect)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [profileId, permissionId, effect]
        );
    }

    async updateEffect(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionId: string,
        effect: PermissionEffect
    ): Promise<ProfilePermissions> {
        return (t ?? this.db).one<ProfilePermissions>(
            `UPDATE ${this.tableName}
             SET effect = $3
             WHERE profile_id = $1 AND permission_id = $2
             RETURNING *`,
            [profileId, permissionId, effect]
        );
    }

    async revoke(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionId: string
    ): Promise<void> {
        await (t ?? this.db).none(
            `DELETE FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`,
            [profileId, permissionId]
        );
    }

    async revokeAllByProfile(
        t: ITask<unknown> | undefined,
        profileId: string
    ): Promise<void> {
        await (t ?? this.db).none(
            `DELETE FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId]
        );
    }

    async replacePermissions(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionIds: string[]
    ): Promise<void> {
        await this.revokeAllByProfile(t, profileId);
        if (permissionIds.length) {
            await this.batchAssign(t, profileId, permissionIds);
        }
    }

    async batchAssign(
        t: ITask<unknown> | undefined,
        profileId: string,
        permissionIds: string[]
    ): Promise<void> {
        if (!permissionIds.length) return;

        await (t ?? this.db).none(
            `INSERT INTO ${this.tableName} (profile_id, permission_id, effect)
             SELECT $1, pid, 'allow'
             FROM UNNEST($2::uuid[]) AS pid`,
            [profileId, permissionIds]
        );
    }

    async getPermissionIdsByProfile(
        t: ITask<unknown> | undefined,
        profileId: string
    ): Promise<string[]> {
        const rows = await this.query<{ permission_id: string }>(
            `SELECT permission_id FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId],
            t
        );
        return rows.map(r => r.permission_id);
    }
}
