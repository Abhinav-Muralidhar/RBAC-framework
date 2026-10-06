import { IDatabase, ITask } from 'pg-promise';
import { ProfilePermissions, PermissionEffect } from '../models/profile_permissions.model';

export interface IProfilePermissionsRepository {
    /** List all permission assignments for a specific profile. */
    findPermissionsByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<ProfilePermissions[]>;
    /** List all profiles that have a specific permission assigned. */
    findProfilesByPermission(t: ITask<unknown> | undefined, permissionId: string): Promise<ProfilePermissions[]>;
    /** Check if a specific permission is linked to a profile. */
    findAssignment(t: ITask<unknown> | undefined, profileId: string, permissionId: string): Promise<ProfilePermissions | null>;
    /** Link a permission to a profile with a specified effect (allow/deny). */
    assign(t: ITask<unknown> | undefined, profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    /** Update the effect (allow/deny) of an existing permission assignment. */
    updateEffect(t: ITask<unknown> | undefined, profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    /** Unlink a specific permission from a profile. */
    revoke(t: ITask<unknown> | undefined, profileId: string, permissionId: string): Promise<void>;
    /** Remove all permission assignments for a profile. */
    revokeAllByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<void>;
    /** Atomically replace all permissions for a profile. */
    replacePermissions(t: ITask<unknown> | undefined, profileId: string, permissionIds: string[]): Promise<void>;
    /** Associate multiple permissions with a profile in bulk (default effect: allow). */
    batchAssign(t: ITask<unknown> | undefined, profileId: string, permissionIds: string[]): Promise<void>;
    /** List only the ID strings of permissions assigned to a profile. */
    getPermissionIdsByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<string[]>;
}

export class ProfilePermissionsRepository implements IProfilePermissionsRepository {
    private tableName = 'profile_permissions';
    private readonly baseColumns = 'profile_id, permission_id, effect';

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
            `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId],
            t
        );
    }

    async findProfilesByPermission(
        t: ITask<unknown> | undefined,
        permissionId: string
    ): Promise<ProfilePermissions[]> {
        return this.query<ProfilePermissions>(
            `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE permission_id = $1`,
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
            `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`,
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
             FROM UNNEST($2::bigint[]) AS pid`,
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
