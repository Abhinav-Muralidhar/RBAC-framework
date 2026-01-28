export interface UserGroup {
  user_id: string;
  group_id: string;

  assigned_at: Date;
  assigned_by?: string | null;
}
