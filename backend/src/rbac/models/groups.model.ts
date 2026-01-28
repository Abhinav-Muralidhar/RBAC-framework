export interface Group {
  id: string;

  name: string;
  code: string;
  description?: string | null;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
}
