export interface Roles {
  id: string;
  version: number;

  name: string;
  code: string;
  description?: string | null;

  parent_role_id?: string | null;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
  updated_at?: Date | null;
  updated_by?: string | null;
}
