import { Pool, QueryResultRow } from 'pg';
import { IDatabase, ITask } from 'pg-promise';
import { UserGroups } from '../models/user_groups.model';

export interface IUserGroupsRepository {
  addMember(userId: string, groupId: string, assignedBy?: string): Promise<void>;
  removeMember(userId: string, groupId: string): Promise<void>;
  findUsersByGroup(groupId: string): Promise<UserGroups[]>;
  findGroupsByUser(userId: string): Promise<UserGroups[]>;
  addMembers(groupId: string, userIds: string[], assignedBy?: string): Promise<void>;
  replaceUsers(groupId: string, userIds: string[], assignedBy?: string): Promise<void>;
}

export class UserGroupsRepository implements IUserGroupsRepository {
  private tableName = 'user_groups';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async addMembers(
    groupId: string,
    userIds: string[],
    assignedBy?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const userId of userIds) {
        await client.query(
          `
          INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
          `,
          [userId, groupId, assignedBy ?? null]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

  async findUsersByGroup(groupId: string): Promise<UserGroups[]> {
    const res = await this.query<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE group_id = $1
      `,
      [groupId]
    );
    return res.rows;
  }

  async findGroupsByUser(userId: string): Promise<UserGroups[]> {
    const res = await this.query<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      `,
      [userId]
    );
    return res.rows;
  }

  async replaceUsers(
    groupId: string,
    userIds: string[],
    assignedBy?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
        DELETE FROM ${this.tableName}
        WHERE group_id = $1
        `,
        [groupId]
      );
      for (const userId of userIds) {
        await client.query(
          `
          INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
          VALUES ($1, $2, $3)
          `,
          [userId, groupId, assignedBy ?? null]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
