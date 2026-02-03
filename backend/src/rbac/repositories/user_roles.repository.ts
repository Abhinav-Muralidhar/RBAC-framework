import { IDatabase, ITask } from 'pg-promise';
import { UserRoles } from '../models/user_roles.model';

export type TransactionTask = ITask<unknown>;

export interface IUserRoleRepository {
  findRolesByUser(t: TransactionTask | undefined, userId: string): Promise<UserRoles[]>;
  findUsersByRole(t: TransactionTask | undefined, roleId: string): Promise<UserRoles[]>;
  hasRole(t: TransactionTask | undefined, userId: string, roleId: string): Promise<boolean>;
  assign(t: TransactionTask | undefined, userId: string, roleId: string, assignedBy?: string): Promise<UserRoles>;
  revoke(t: TransactionTask | undefined, userId: string, roleId: string): Promise<void>;
  revokeAllByUser(t: TransactionTask | undefined, userId: string): Promise<void>;
  assignAllByUser(
    t: TransactionTask | undefined,
    userId: string,
    roleIds: string[],
    assignedBy?: string
  ): Promise<void>;
}

export class UserRoleRepository implements IUserRoleRepository {
  private tableName = 'user_roles';

  constructor(private db: IDatabase<unknown>) { }

  private getTask(t?: TransactionTask) {
    return t ?? this.db;
  }

  async findRolesByUser(t: TransactionTask | undefined, userId: string): Promise<UserRoles[]> {
    return this.getTask(t).any<UserRoles>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
  }

  async findUsersByRole(t: TransactionTask | undefined, roleId: string): Promise<UserRoles[]> {
    return this.getTask(t).any<UserRoles>(
      `SELECT * FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
  }

  async hasRole(t: TransactionTask | undefined, userId: string, roleId: string): Promise<boolean> {
    const rows = await this.getTask(t).any(
      `SELECT 1 FROM ${this.tableName} WHERE user_id = $1 AND role_id = $2 LIMIT 1`,
      [userId, roleId]
    );
    return rows.length > 0;
  }

  async assign(
    t: TransactionTask | undefined,
    userId: string,
    roleId: string,
    assignedBy?: string
  ): Promise<UserRoles> {
    return this.getTask(t).one<UserRoles>(
      `
        INSERT INTO ${this.tableName} (user_id, role_id, assigned_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [userId, roleId, assignedBy ?? null]
    );
  }

  async revoke(t: TransactionTask | undefined, userId: string, roleId: string): Promise<void> {
    await this.getTask(t).none(
      `DELETE FROM ${this.tableName} WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId]
    );
  }

  async revokeAllByUser(t: TransactionTask | undefined, userId: string): Promise<void> {
    await this.getTask(t).none(
      `DELETE FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
  }

  async assignAllByUser(
    t: TransactionTask | undefined,
    userId: string,
    roleIds: string[],
    assignedBy?: string
  ): Promise<void> {
    if (!roleIds.length) return;

    const task = this.getTask(t);

    const valuesPlaceholders = roleIds
      .map((_, i) => `($1, $${i + 2}, $${roleIds.length + 2})`)
      .join(', ');

    const params = [userId, ...roleIds, assignedBy ?? null];

    await task.none(
      `
        INSERT INTO ${this.tableName} (user_id, role_id, assigned_by)
        VALUES ${valuesPlaceholders}
        ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      params
    );
  }
}