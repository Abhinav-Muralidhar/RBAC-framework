export interface Group {
  id: bigint;

  name: string;
  code: string;
  description?: string | null;

  is_active: boolean;

  created_at: Date;
  created_by?: bigint | null;
}
