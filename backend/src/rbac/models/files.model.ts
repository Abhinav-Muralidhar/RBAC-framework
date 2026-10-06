export interface Files {
  id: string;
  version: number;
  storage_path: string;
  original_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at: Date;
  created_by?: string | null;
  updated_at?: Date | null;
  updated_by?: string | null;
}
