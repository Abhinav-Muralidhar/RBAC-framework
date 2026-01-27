export interface Roles {
  id: bigint;

  name: string;
  code: string;
  description?: string | null;

  parent_role_id?: bigint | null;

  is_active: boolean;

  created_at: Date;
  created_by?: bigint | null;
}
