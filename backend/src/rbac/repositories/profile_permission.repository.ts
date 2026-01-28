import { Pool, QueryResultRow } from 'pg';
import { ProfilePermission, PermissionEffect } from '../models/profile_permission.model';

export interface IProfilePermissionRepository {
    findPermissionsByProfile(profileId: string): Promise<ProfilePermission[]>;
    findProfilesByPermission(permissionId: string): Promise<ProfilePermission[]>;
    findAssignment(profileId: string, permissionId: string): Promise<ProfilePermission | null>;
    assign(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermission>;
    updateEffect(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermission>;
    revoke(profileId: string, permissionId: string): Promise<void>;
    revokeAllByProfile(profileId: string): Promise<void>;
    replacePermissions(profileId: string, permissionIds: string[]): Promise<void>;
    batchAssign(profileId: string, permissionIds: string[]): Promise<void>;
}

export class ProfilePermissionRepository implements IProfilePermissionRepository {
    private tableName = 'profile_permissions';

    constructor(private pool: InstanceType<typeof Pool>) {}

    private async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
        return this.pool.query<T>(text, params);
    }

    async findPermissionsByProfile(profileId: string): Promise<ProfilePermission[]> {
        const res = await this.query<ProfilePermission>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId]
        );
        return res.rows;
    }

    async findProfilesByPermission(permissionId: string): Promise<ProfilePermission[]> {
        const res = await this.query<ProfilePermission>(
            `SELECT * FROM ${this.tableName} WHERE permission_id = $1`,
            [permissionId]
        );
        return res.rows;
    }

    async findAssignment(profileId: string, permissionId: string): Promise<ProfilePermission | null> {
        const res = await this.query<ProfilePermission>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`,
            [profileId, permissionId]
        );
        return res.rows[0] || null;
    }

    async assign(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermission> {
        const res = await this.query<ProfilePermission>(
            `INSERT INTO ${this.tableName} (profile_id, permission_id, effect) VALUES ($1, $2, $3) RETURNING *`,
            [profileId, permissionId, effect]
        );
        return res.rows[0]!;
    }

    async updateEffect(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermission> {
        const res = await this.query<ProfilePermission>(
            `UPDATE ${this.tableName} SET effect = $3 WHERE profile_id = $1 AND permission_id = $2 RETURNING *`,
            [profileId, permissionId, effect]
        );
        if (!res.rows.length) throw new Error('Assignment not found');
        return res.rows[0]!;
    }

    async revoke(profileId: string, permissionId: string): Promise<void> {
        await this.query(`DELETE FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`, [profileId, permissionId]);
    }

    async revokeAllByProfile(profileId: string): Promise<void> {
        await this.query(`DELETE FROM ${this.tableName} WHERE profile_id = $1`, [profileId]);
    }

    async replacePermissions(profileId: string, permissionIds: string[]): Promise<void> {
        await this.revokeAllByProfile(profileId);
        if (permissionIds.length) await this.batchAssign(profileId, permissionIds);
    }

    async batchAssign(profileId: string, permissionIds: string[]): Promise<void> {
        if (!permissionIds.length) return;

        const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
        await this.query(
            `INSERT INTO ${this.tableName} (profile_id, permission_id) VALUES ${values}`,
            [profileId, ...permissionIds]
        );
    }
}
