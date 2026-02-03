import { IDatabase, ITask } from 'pg-promise';

export interface IGroupRoleRepository {
  assignRole(t: ITask<unknown> | undefined, groupId: string, roleId: string, assignedBy?: string | null): Promise<void>;
  removeRole(t: ITask<unknown> | undefined, groupId: string, roleId: string): Promise<void>;
  replaceRoles(t: ITask<unknown> | undefined, groupId: string, roleIds: string[], assignedBy?: string | null): Promise<void>;
  findRolesByGroup(t: ITask<unknown> | undefined, groupId: string): Promise<string[]>;
  findGroupsByRole(t: ITask<unknown> | undefined, roleId: string): Promise<string[]>;
}

export class GroupRoleRepository implements IGroupRoleRepository {
  private tableName = 'group_roles';

  constructor(private db: IDatabase<unknown>) { }

  protected async query<T>(text: string, params?: unknown[], t?: ITask<unknown>): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async assignRole(t: ITask<unknown> | undefined, groupId: string, roleId: string, assignedBy?: string | null): Promise<void> {
    await (t ?? this.db).none(
      `INSERT INTO ${this.tableName} (group_id, role_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [groupId, roleId, assignedBy ?? null]
    );
  }

  async removeRole(t: ITask<unknown> | undefined, groupId: string, roleId: string): Promise<void> {
    await (t ?? this.db).none(
      `DELETE FROM ${this.tableName} WHERE group_id = $1 AND role_id = $2`,
      [groupId, roleId]
    );
  }

  async replaceRoles(t: ITask<unknown> | undefined, groupId: string, roleIds: string[], assignedBy?: string | null): Promise<void> {
    await (t ?? this.db).tx(async tx => {
      await tx.none(`DELETE FROM ${this.tableName} WHERE group_id = $1`, [groupId]);

      if (roleIds.length > 0) {
        const values: unknown[] = [];
        const placeholders = roleIds.map((_, i) => {
          const idx = i * 3 + 1;
          values.push(groupId, roleIds[i], assignedBy ?? null);
          return `($${idx}, $${idx + 1}, $${idx + 2})`;
        }).join(', ');

        await tx.none(
          `INSERT INTO ${this.tableName} (group_id, role_id, assigned_by) VALUES ${placeholders}`,
          values
        );
      }
    });
  }

  async findRolesByGroup(t: ITask<unknown> | undefined, groupId: string): Promise<string[]> {
    const res = await this.query<{ role_id: string }>(
      `SELECT role_id FROM ${this.tableName} WHERE group_id = $1`,
      [groupId],
      t
    );
    return res.map(r => r.role_id);
  }

  async findGroupsByRole(t: ITask<unknown> | undefined, roleId: string): Promise<string[]> {
    const res = await this.query<{ group_id: string }>(
      `SELECT group_id FROM ${this.tableName} WHERE role_id = $1`,
      [roleId],
      t
    );
    return res.map(r => r.group_id);
  }
}
