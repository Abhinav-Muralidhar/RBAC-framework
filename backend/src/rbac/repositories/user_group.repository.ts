import { Pool, QueryResultRow } from 'pg';
import { UserGroup } from '../models/user_groups.model';

export interface IUserGroupRepository {
  addMember(userId: string, groupId: string, assignedBy?: string): Promise<void>;
  removeMember(userId: string, groupId: string): Promise<void>;
  findUsersByGroup(groupId: string): Promise<UserGroup[]>;
  findGroupsByUser(userId: string): Promise<UserGroup[]>;
}

export class UserGroupRepository implements IUserGroupRepository {
  private tableName = 'user_groups';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async addMember(
    userId: string,
    groupId: string,
    assignedBy?: string
  ): Promise<void> {
    await this.query(
      `
      INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [userId, groupId, assignedBy ?? null]
    );
  }

  async removeMember(userId: string, groupId: string): Promise<void> {
    await this.query(
      `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1 AND group_id = $2
      `,
      [userId, groupId]
    );
  }

  async findUsersByGroup(groupId: string): Promise<UserGroup[]> {
    const res = await this.query<UserGroup>(
      `
      SELECT * FROM ${this.tableName}
      WHERE group_id = $1
      `,
      [groupId]
    );
    return res.rows;
  }

  async findGroupsByUser(userId: string): Promise<UserGroup[]> {
    const res = await this.query<UserGroup>(
      `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      `,
      [userId]
    );
    return res.rows;
  }
}
