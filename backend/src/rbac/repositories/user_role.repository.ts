import { Pool, QueryResultRow } from 'pg';
import { User_Role } from '../models/user_role.model';

export interface IUserRoleRepository {
  findRolesByUser(userId: string): Promise<User_Role[]>;
  findUsersByRole(roleId: string): Promise<User_Role[]>;
  hasRole(userId: string, roleId: string): Promise<boolean>;
  assign(userId: string, roleId: string, assignedBy?: string): Promise<User_Role>;
  revoke(userId: string, roleId: string): Promise<void>;
  revokeAllByUser(userId: string): Promise<void>;
}

export class UserRoleRepository implements IUserRoleRepository {
  private tableName = 'user_roles';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findRolesByUser(userId: string): Promise<User_Role[]> {
    const res = await this.query<User_Role>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async findUsersByRole(roleId: string): Promise<User_Role[]> {
    const res = await this.query<User_Role>(
      `SELECT * FROM ${this.tableName} WHERE role_id = $1`,
      [roleId]
    );
    return res.rows;
  }

  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const res = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId]
    );
    return (res.rowCount || 0) > 0;
  }

  async assign(userId: string, roleId: string, assignedBy?: string): Promise<User_Role> {
    const query = `
      INSERT INTO ${this.tableName} (user_id, role_id, assigned_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await this.query<User_Role>(query, [userId, roleId, assignedBy ?? null]);
    return res.rows[0]!;
  }

  async revoke(userId: string, roleId: string): Promise<void> {
    await this.query(
      `DELETE FROM ${this.tableName} WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId]
    );
  }

  async revokeAllByUser(userId: string): Promise<void> {
    await this.query(`DELETE FROM ${this.tableName} WHERE user_id = $1`, [userId]);
  }
}
