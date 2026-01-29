import { Pool, QueryResultRow } from 'pg';
import { ProfilePermissions, PermissionEffect } from '../models/profile_permissions.model';

export interface IProfilePermissionsRepository {
    findPermissionsByProfile(profileId: string): Promise<ProfilePermissions[]>;
    findProfilesByPermission(permissionId: string): Promise<ProfilePermissions[]>;
    findAssignment(profileId: string, permissionId: string): Promise<ProfilePermissions | null>;
    assign(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    updateEffect(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions>;
    revoke(profileId: string, permissionId: string): Promise<void>;
    revokeAllByProfile(profileId: string): Promise<void>;
    replacePermissions(profileId: string, permissionIds: string[]): Promise<void>;
    batchAssign(profileId: string, permissionIds: string[]): Promise<void>;
    getPermissionIdsByProfile(profileId: string): Promise<string[]>;
}

export class ProfilePermissionsRepository implements IProfilePermissionsRepository {
    private tableName = 'profile_permissions';

    constructor(private pool: InstanceType<typeof Pool>) { }

    private async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
        return this.pool.query<T>(text, params);
    }

    async findPermissionsByProfile(profileId: string): Promise<ProfilePermissions[]> {
        const res = await this.query<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId]
        );
        return res.rows;
    }

    async findProfilesByPermission(permissionId: string): Promise<ProfilePermissions[]> {
        const res = await this.query<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE permission_id = $1`,
            [permissionId]
        );
        return res.rows;
    }

    async findAssignment(profileId: string, permissionId: string): Promise<ProfilePermissions | null> {
        const res = await this.query<ProfilePermissions>(
            `SELECT * FROM ${this.tableName} WHERE profile_id = $1 AND permission_id = $2`,
            [profileId, permissionId]
        );
        return res.rows[0] || null;
    }

    async assign(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions> {
        const res = await this.query<ProfilePermissions>(
            `INSERT INTO ${this.tableName} (profile_id, permission_id, effect) VALUES ($1, $2, $3) RETURNING *`,
            [profileId, permissionId, effect]
        );
        return res.rows[0]!;
    }

    async updateEffect(profileId: string, permissionId: string, effect: PermissionEffect): Promise<ProfilePermissions> {
        const res = await this.query<ProfilePermissions>(
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

        const values = permissionIds.map((_, i) => `($1, $${i + 2},'allow')`).join(', ');
        await this.query(
            `INSERT INTO ${this.tableName} (profile_id, permission_id,effect) VALUES ${values}`,
            [profileId, ...permissionIds]
        );
    }

    async getPermissionIdsByProfile(profileId: string): Promise<string[]> {
        const res = await this.query<{ permission_id: string }>(
            `SELECT permission_id FROM ${this.tableName} WHERE profile_id = $1`,
            [profileId]
        );
        return res.rows.map(r => r.permission_id);
    }

}
