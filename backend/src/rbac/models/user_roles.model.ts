export interface UserRoles {
  user_id: string;
  role_id: string;

  assigned_at: Date;
  assigned_by?: string | null;
}
