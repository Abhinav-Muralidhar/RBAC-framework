export interface Groups {
  id: string;

  name: string;
  code: string;
  description?: string | null;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
}
