import { Pool, QueryResultRow } from 'pg';

export interface IGroupRoleRepository {
  assignRole(groupId: string, roleId: string, assignedBy?: string | null): Promise<void>;
  removeRole(groupId: string, roleId: string): Promise<void>;
  replaceRoles(groupId: string, roleIds: string[], assignedBy?: string | null): Promise<void>;
  findRolesByGroup(groupId: string): Promise<string[]>;
  findGroupsByRole(roleId: string): Promise<string[]>;
}

export class GroupRoleRepository implements IGroupRoleRepository {
  private tableName = 'group_roles';

  constructor(private pool: InstanceType<typeof Pool>) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query<T>(text, params);
  }

  async assignRole(
    groupId: string,
    roleId: string,
    assignedBy?: string | null
  ): Promise<void> {
    await this.query(
      `
      INSERT INTO ${this.tableName} (group_id, role_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [groupId, roleId, assignedBy ?? null]
    );
  }

  async removeRole(groupId: string, roleId: string): Promise<void> {
    await this.query(
      `
      DELETE FROM ${this.tableName}
      WHERE group_id = $1 AND role_id = $2
      `,
      [groupId, roleId]
    );
  }

  async replaceRoles(
    groupId: string,
    roleIds: string[],
    assignedBy?: string | null
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Start a transaction
      await client.query('BEGIN');

      // Remove all existing roles for this group
      await client.query(
        `DELETE FROM ${this.tableName} WHERE group_id = $1`,
        [groupId]
      );

      // If there are new roles to assign
      if (roleIds.length > 0) {
        const values: unknown[] = [];

        // Build the placeholders dynamically and fill the values array
        const placeholders = roleIds.map((roleId) => {
          values.push(groupId, roleId, assignedBy ?? null);
          const idx = values.length - 2; // index of roleId in values
          return `($${idx}, $${idx + 1}, $${idx + 2})`;
        }).join(', ');

        // Single insert for all roles
        await client.query(
          `INSERT INTO ${this.tableName} (group_id, role_id, assigned_by) VALUES ${placeholders}`,
          values
        );
      }

      // Commit the transaction
      await client.query('COMMIT');
    } catch (err) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findRolesByGroup(groupId: string): Promise<string[]> {
    const res = await this.query<{ role_id: string }>(
      `
      SELECT role_id
      FROM ${this.tableName}
      WHERE group_id = $1
      `,
      [groupId]
    );

    return res.rows.map(r => r.role_id);
  }

  async findGroupsByRole(roleId: string): Promise<string[]> {
    const res = await this.query<{ group_id: string }>(
      `
      SELECT group_id
      FROM ${this.tableName}
      WHERE role_id = $1
      `,
      [roleId]
    );

    return res.rows.map(r => r.group_id);
  }
}
