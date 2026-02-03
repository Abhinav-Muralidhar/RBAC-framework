import { IDatabase, ITask } from 'pg-promise';
import { RoleProfiles } from '../models/role_profiles.model';

export interface IRoleProfilesRepository {
  findProfilesByRole(t: ITask<unknown> | undefined, roleId: string): Promise<RoleProfiles[]>;
  findRolesByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<RoleProfiles[]>;
  hasProfile(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<boolean>;
  assign(t: ITask<unknown> | undefined, roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfiles>;
  revoke(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<void>;
  revokeAllByRole(t: ITask<unknown> | undefined, roleId: string): Promise<void>;
  assignAllByRole(t: ITask<unknown> | undefined, roleId: string, profileIds: string[], assignedBy?: string): Promise<void>;
}

export class RoleProfilesRepository implements IRoleProfilesRepository {
  private tableName = 'role_profiles';

  constructor(private db: IDatabase<unknown>) { }

  protected query<T>(text: string, params?: unknown[], t?: ITask<unknown>): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findProfilesByRole(t: ITask<unknown> | undefined, roleId: string): Promise<RoleProfiles[]> {
    return this.query<RoleProfiles>(
      `SELECT * FROM ${this.tableName} WHERE role_id = $1`,
      [roleId],
      t
    );
  }

  async findRolesByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<RoleProfiles[]> {
    return this.query<RoleProfiles>(
      `SELECT * FROM ${this.tableName} WHERE profile_id = $1`,
      [profileId],
      t
    );
  }

  async hasProfile(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<boolean> {
    const res = await (t ?? this.db).oneOrNone<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE role_id = $1 AND profile_id = $2) AS exists`,
      [roleId, profileId]
    );
    return res?.exists ?? false;
  }

  async assign(
    t: ITask<unknown> | undefined,
    roleId: string,
    profileId: string,
    assignedBy?: string
  ): Promise<RoleProfiles> {
    return (t ?? this.db).one<RoleProfiles>(
      `INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [roleId, profileId, assignedBy ?? null]
    );
  }

  async revoke(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<void> {
    await (t ?? this.db).none(
      `DELETE FROM ${this.tableName} WHERE role_id = $1 AND profile_id = $2`,
      [roleId, profileId]
    );
  }

  async revokeAllByRole(t: ITask<unknown> | undefined, roleId: string): Promise<void> {
    await (t ?? this.db).none(
      `DELETE FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
  }

  async assignAllByRole(
    t: ITask<unknown> | undefined,
    roleId: string,
    profileIds: string[],
    assignedBy?: string
  ): Promise<void> {
    if (!profileIds.length) return;

    await this.revokeAllByRole(t, roleId);

    const values = profileIds
      .map((_, i) => `($1, $${i + 2}, $${profileIds.length + 2})`)
      .join(', ');

    await (t ?? this.db).none(
      `INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by) VALUES ${values}`,
      [roleId, ...profileIds, assignedBy ?? null]
    );
  }
}
