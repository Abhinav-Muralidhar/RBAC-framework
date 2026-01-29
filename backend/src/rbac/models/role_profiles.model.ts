export interface RoleProfiles {
  role_id: string;
  profile_id: string;

  assigned_at: Date;
  assigned_by?: string | null;
}
