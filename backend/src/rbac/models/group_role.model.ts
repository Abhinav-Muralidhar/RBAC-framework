export interface GroupRole {
  group_id: bigint;
  role_id: bigint;

  assigned_at: Date;
  assigned_by?: bigint | null;
}
