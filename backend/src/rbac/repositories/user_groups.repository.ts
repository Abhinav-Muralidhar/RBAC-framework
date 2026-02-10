import { IDatabase, ITask } from 'pg-promise';
import { UserGroups } from '../models/user_groups.model';

export type TransactionTask = ITask<unknown>;

export interface IUserGroupsRepository {
  addMember(t: TransactionTask | undefined, userId: string, groupId: string, assignedBy?: string): Promise<void>;
  removeMember(t: TransactionTask | undefined, userId: string, groupId: string): Promise<void>;
  findUsersByGroup(t: TransactionTask | undefined, groupId: string): Promise<UserGroups[]>;
  findGroupsByUser(t: TransactionTask | undefined, userId: string): Promise<UserGroups[]>;
  addMembers(t: TransactionTask | undefined, groupId: string, userIds: string[], assignedBy?: string): Promise<void>;
  replaceUsers(t: TransactionTask | undefined, groupId: string, userIds: string[], assignedBy?: string): Promise<void>;
}

export class UserGroupsRepository implements IUserGroupsRepository {
  private tableName = 'user_groups';

  constructor(private db: IDatabase<unknown>) { }

  protected async query<T>(
    text: string,
    params?: unknown[],
    t?: TransactionTask
  ): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async addMember(
    t: TransactionTask | undefined,
    userId: string,
    groupId: string,
    assignedBy?: string
  ): Promise<void> {
    await (t ?? this.db).none(
      `
      INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [userId, groupId, assignedBy ?? null]
    );
  }

  async removeMember(
    t: TransactionTask | undefined,
    userId: string,
    groupId: string
  ): Promise<void> {
    await (t ?? this.db).none(
      `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1 AND group_id = $2
      `,
      [userId, groupId]
    );
  }

  async findUsersByGroup(
    t: TransactionTask | undefined,
    groupId: string
  ): Promise<UserGroups[]> {
    return this.query<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE group_id = $1
      `,
      [groupId],
      t
    );
  }

  async findGroupsByUser(
    t: TransactionTask | undefined,
    userId: string
  ): Promise<UserGroups[]> {
    return this.query<UserGroups>(
      `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      `,
      [userId],
      t
    );
  }

  async addMembers(
    t: TransactionTask | undefined,
    groupId: string,
    userIds: string[],
    assignedBy?: string
  ): Promise<void> {
    const executor = t ?? this.db;

    await executor.none(
      `
    INSERT INTO ${this.tableName} (user_id, group_id, assigned_by)
    SELECT unnest($1::bigint[]), $2, $3
    ON CONFLICT DO NOTHING
    `,
      [userIds, groupId, assignedBy ?? null]
    );
  }



  async replaceUsers(
    t: TransactionTask | undefined,
    groupId: string,
    userIds: string[],
    assignedBy?: string
  ): Promise<void> {
    const executor = t ?? this.db;
    await executor.none(
      `DELETE FROM ${this.tableName} WHERE group_id = $1`,
      [groupId]
    );
    await this.addMembers(executor as TransactionTask, groupId, userIds, assignedBy);
  }
}
