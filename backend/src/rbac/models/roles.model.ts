export interface Roles {
  id: string;

  name: string;
  code: string;
  description?: string | null;

  parent_role_id?: string | null;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
}
