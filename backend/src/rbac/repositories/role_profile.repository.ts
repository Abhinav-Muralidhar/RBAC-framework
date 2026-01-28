import { Pool, QueryResultRow } from 'pg';
import { RoleProfile } from '../models/role_profile.model';

export interface IRoleProfileRepository {
  findProfilesByRole(roleId: string): Promise<RoleProfile[]>;
  findRolesByProfile(profileId: string): Promise<RoleProfile[]>;
  hasProfile(roleId: string, profileId: string): Promise<boolean>;
  assign(roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfile>;
  revoke(roleId: string, profileId: string): Promise<void>;
  revokeAllByRole(roleId: string): Promise<void>;
}

export class RoleProfileRepository implements IRoleProfileRepository {
  private tableName = 'role_profiles';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findProfilesByRole(roleId: string): Promise<RoleProfile[]> {
    const res = await this.query<RoleProfile>(
      `SELECT * FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
    return res.rows;
  }

  async findRolesByProfile(profileId: string): Promise<RoleProfile[]> {
    const res = await this.query<RoleProfile>(
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

  async assign(roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfile> {
    const query = `
      INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await this.query<RoleProfile>(query, [roleId, profileId, assignedBy ?? null]);
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
}
