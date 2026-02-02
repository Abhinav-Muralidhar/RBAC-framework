import { IDatabase, ITask } from 'pg-promise';

export interface IGroupRoleRepository {
  assignRole(groupId: string, roleId: string, assignedBy?: string | null, t?: ITask<unknown>): Promise<void>;
  removeRole(groupId: string, roleId: string, t?: ITask<unknown>): Promise<void>;
  replaceRoles(groupId: string, roleIds: string[], assignedBy?: string | null, t?: ITask<unknown>): Promise<void>;
  findRolesByGroup(groupId: string, t?: ITask<unknown>): Promise<string[]>;
  findGroupsByRole(roleId: string, t?: ITask<unknown>): Promise<string[]>;
}

export class GroupRoleRepository implements IGroupRoleRepository {
  private tableName = 'group_roles';

  constructor(private db: IDatabase<unknown>) { }

  protected async query<T>(text: string, params?: unknown[], t?: ITask<unknown>): Promise<T[]> {
    return (t ?? this.db).any<T>(text, params);
  }

  async assignRole(groupId: string, roleId: string, assignedBy?: string | null, t?: ITask<unknown>): Promise<void> {
    await (t ?? this.db).none(
      `INSERT INTO ${this.tableName} (group_id, role_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [groupId, roleId, assignedBy ?? null]
    );
  }

  async removeRole(groupId: string, roleId: string, t?: ITask<unknown>): Promise<void> {
    await (t ?? this.db).none(`DELETE FROM ${this.tableName} WHERE group_id = $1 AND role_id = $2`, [groupId, roleId]);
  }

  async replaceRoles(groupId: string, roleIds: string[], assignedBy?: string | null, t?: ITask<unknown>): Promise<void> {
    await (t ?? this.db).tx(async t => {
      await t.none(`DELETE FROM ${this.tableName} WHERE group_id = $1`, [groupId]);

      if (roleIds.length > 0) {
        const values: unknown[] = [];
        const placeholders = roleIds.map((_, i) => {
          const idx = i * 3 + 1;
          values.push(groupId, roleIds[i], assignedBy ?? null);
          return `($${idx}, $${idx + 1}, $${idx + 2})`;
        }).join(', ');


        await t.none(`INSERT INTO ${this.tableName} (group_id, role_id, assigned_by) VALUES ${placeholders}`, values);
      }
    });
  }

  async findRolesByGroup(groupId: string, t?: ITask<unknown>): Promise<string[]> {
    const res = await this.query<{ role_id: string }>(`SELECT role_id FROM ${this.tableName} WHERE group_id = $1`, [groupId], t);
    return res.map(r => r.role_id);
  }

  async findGroupsByRole(roleId: string, t?: ITask<unknown>): Promise<string[]> {
    const res = await this.query<{ group_id: string }>(`SELECT group_id FROM ${this.tableName} WHERE role_id = $1`, [roleId], t);
    return res.map(r => r.group_id);
  }
}
