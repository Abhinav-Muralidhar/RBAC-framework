export interface RoleProfile {
  role_id: bigint;
  profile_id: bigint;

  assigned_at: Date;
  assigned_by?: bigint | null;
}
