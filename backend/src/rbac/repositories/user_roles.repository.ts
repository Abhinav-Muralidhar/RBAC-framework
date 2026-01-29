import { Pool, QueryResultRow } from 'pg';
import { UserRoles } from '../models/user_roles.model';

export interface IUserRoleRepository {
  findRolesByUser(userId: string): Promise<UserRoles[]>;
  findUsersByRole(roleId: string): Promise<UserRoles[]>;
  hasRole(userId: string, roleId: string): Promise<boolean>;
  assign(userId: string, roleId: string, assignedBy?: string): Promise<UserRoles>;
  revoke(userId: string, roleId: string): Promise<void>;
  revokeAllByUser(userId: string): Promise<void>;
}

export class UserRoleRepository implements IUserRoleRepository {
  private tableName = 'user_roles';

  constructor(private pool: InstanceType<typeof Pool>) { }

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async findRolesByUser(userId: string): Promise<UserRoles[]> {
    const res = await this.query<UserRoles>(
      `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async findUsersByRole(roleId: string): Promise<UserRoles[]> {
    const res = await this.query<UserRoles>(
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

  async assign(userId: string, roleId: string, assignedBy?: string): Promise<UserRoles> {
    const query = `
      INSERT INTO ${this.tableName} (user_id, role_id, assigned_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await this.query<UserRoles>(query, [userId, roleId, assignedBy ?? null]);
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

  async assignAllByUser(userId: string, roleIds: string[], assignedBy?: string): Promise<void> {
    if (!roleIds.length) return;

    const values = roleIds
      .map((_, i) => `($1, $${i + 2}, $${roleIds.length + 2})`)
      .join(', ');

    await this.query(
      `INSERT INTO ${this.tableName} (user_id, role_id, assigned_by) VALUES ${values}
      ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, ...roleIds, assignedBy ?? null]
    );
  }

}
