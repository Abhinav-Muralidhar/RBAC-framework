import { IDatabase, ITask } from 'pg-promise';
import { UserGroups } from '../models/user_groups.model';

export type TransactionTask = ITask<unknown>;

export interface IUserGroupsRepository {
  addMember(userId: string, groupId: string, assignedBy?: string, t?: TransactionTask): Promise<void>;
  removeMember(userId: string, groupId: string, t?: TransactionTask): Promise<void>;
  findUsersByGroup(groupId: string, t?: TransactionTask): Promise<UserGroups[]>;
  findGroupsByUser(userId: string, t?: TransactionTask): Promise<UserGroups[]>;
  addMembers(groupId: string, userIds: string[], assignedBy?: string, t?: TransactionTask): Promise<void>;
  replaceUsers(groupId: string, userIds: string[], assignedBy?: string, t?: TransactionTask): Promise<void>;
}

export class UserGroupsRepository implements IUserGroupsRepository {
  private tableName = 'user_groups';

  constructor(private db: IDatabase<unknown>) { }

  async addMember(
    userId: string,
    groupId: string,
    assignedBy?: string,
    t?: TransactionTask
  ): Promise<void> {
    const executor = t || this.db;
    await executor.none(
      `
      INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [userId, groupId, assignedBy ?? null]
    );
  }

  async removeMember(userId: string, groupId: string, t?: TransactionTask): Promise<void> {
    const executor = t || this.db;
    await executor.none(
      `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1 AND group_id = $2
      `,
      [userId, groupId]
    );
  }

  async findUsersByGroup(groupId: string, t?: TransactionTask): Promise<UserGroups[]> {
    const executor = t || this.db;
    return executor.manyOrNone<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE group_id = $1
      `,
      [groupId]
    );
  }

  async findGroupsByUser(userId: string, t?: TransactionTask): Promise<UserGroups[]> {
    const executor = t || this.db;
    return executor.manyOrNone<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      `,
      [userId]
    );
  }

  async addMembers(
    groupId: string,
    userIds: string[],
    assignedBy?: string,
    t?: TransactionTask
  ): Promise<void> {
    const executor = t || this.db;
    for (const userId of userIds) {
      await this.addMember(userId, groupId, assignedBy, executor as TransactionTask);
    }
  }


  async replaceUsers(
    groupId: string,
    userIds: string[],
    assignedBy?: string,
    t?: TransactionTask
  ): Promise<void> {
    const executor = t || this.db;
    await executor.none(
      `DELETE FROM ${this.tableName} WHERE group_id = $1`,
      [groupId]
    );
    for (const userId of userIds) {
      await this.addMember(userId, groupId, assignedBy, executor as TransactionTask);
    }
  }
}
