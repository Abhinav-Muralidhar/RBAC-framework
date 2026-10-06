import { IDatabase, ITask } from 'pg-promise';
import { RoleProfiles } from '../models/role_profiles.model';

export interface IRoleProfilesRepository {
  /** List all profile associations for a given role. */
  findProfilesByRole(t: ITask<unknown> | undefined, roleId: string): Promise<RoleProfiles[]>;
  /** List all roles that have a specific profile assigned. */
  findRolesByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<RoleProfiles[]>;
  /** Check if a role is linked to a specific profile. */
  hasProfile(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<boolean>;
  /** Link a profile to a role. */
  assign(t: ITask<unknown> | undefined, roleId: string, profileId: string, assignedBy?: string): Promise<RoleProfiles>;
  /** Unlink a profile from a role. */
  revoke(t: ITask<unknown> | undefined, roleId: string, profileId: string): Promise<void>;
  /** Remove all profile associations for a role. */
  revokeAllByRole(t: ITask<unknown> | undefined, roleId: string): Promise<void>;
  /** Atomically replace all profiles associated with a role. */
  assignAllByRole(t: ITask<unknown> | undefined, roleId: string, profileIds: string[], assignedBy?: string): Promise<void>;
  /** List assignments filtered by an array of profile IDs. */
  findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<RoleProfiles[]>;
}

export class RoleProfilesRepository implements IRoleProfilesRepository {
  private tableName = 'role_profiles';
  private readonly baseColumns = 'role_id, profile_id, assigned_at, assigned_by';

  constructor(private db: IDatabase<unknown>) { }

  protected query<T>(text: string, params?: unknown[], t?: ITask<unknown>): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async findProfilesByRole(t: ITask<unknown> | undefined, roleId: string): Promise<RoleProfiles[]> {
    return this.query<RoleProfiles>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE role_id = $1`,
      [roleId],
      t
    );
  }
  async findByIds(t: ITask<unknown> | undefined, ids: string[]): Promise<RoleProfiles[]> {
    const numericIds = ids.map(id => BigInt(id));
    return this.query<RoleProfiles>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE profile_id = ANY($1::bigint[])`,
      [numericIds],
      t
    );
  }

  async findRolesByProfile(t: ITask<unknown> | undefined, profileId: string): Promise<RoleProfiles[]> {
    return this.query<RoleProfiles>(
      `SELECT ${this.baseColumns} FROM ${this.tableName} WHERE profile_id = $1`,
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
    const numericProfileIds = profileIds.map(id => BigInt(id));


    await this.revokeAllByRole(t, roleId);

    const values = numericProfileIds
      .map((_, i) => `($1, $${i + 2}, $${numericProfileIds.length + 2})`)
      .join(', ');

    await (t ?? this.db).none(
      `INSERT INTO ${this.tableName} (role_id, profile_id, assigned_by) VALUES ${values}`,
      [roleId, ...numericProfileIds, assignedBy ?? null]
    );
  }
}
