import { Pool, QueryResultRow } from 'pg';
import { RoleProfiles } from '../models/role_profiles.model';

export interface IRoleProfilesRepository {
  findProfilesByRole(roleId: string): Promise<RoleProfiles[]>;
  findRolesByProfile(profileId: string): Promise<RoleProfiles[]>;
  hasProfile(roleId: string, profileId: string): Promise<boolean>;
  assign(roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfiles>;
  revoke(roleId: string, profileId: string): Promise<void>;
  revokeAllByRole(roleId: string): Promise<void>;
  assignAllByRole(roleId: string, profileIds: string[], assignedBy?: string): Promise<void>;
}

export class RoleProfilesRepository implements IRoleProfilesRepository {
  private tableName = 'role_profiles';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findProfilesByRole(roleId: string): Promise<RoleProfiles[]> {
    const res = await this.query<RoleProfiles>(
      `SELECT * FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
    return res.rows;
  }

  async findRolesByProfile(profileId: string): Promise<RoleProfiles[]> {
    const res = await this.query<RoleProfiles>(
      `SELECT * FROM ${this.tableName} WHERE profile_id = $1`,
      [profileId]
    );
    return res.rows;
  }

  async hasProfile(roleId: string, profileId: string): Promise<boolean> {
    const res = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE role_id = $1 AND profile_id = $2`,
      [roleId, profileId]
    );
    return (res.rowCount || 0) > 0;
  }

  async assign(roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfiles> {
    const query = `
      INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await this.query<RoleProfiles>(query, [roleId, profileId, assignedBy ?? null]);
    return res.rows[0]!;
  }

  async revoke(roleId: string, profileId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE role_id = $1 AND profile_id = $2`,
      [roleId, profileId]
    );
  }

  async revokeAllByRole(roleId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
  }
  async assignAllByRole(roleId: string, profileIds: string[], assignedBy?: string): Promise<void> {
    if (!profileIds.length) return;
    const values = profileIds.map((_, i) => `($1, $${i + 2}, $${profileIds.length + 2})`).join(', ');
    await this.query(
      `INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by) VALUES ${values}`,
      [roleId, ...profileIds, assignedBy ?? null]
    );
  }
}
