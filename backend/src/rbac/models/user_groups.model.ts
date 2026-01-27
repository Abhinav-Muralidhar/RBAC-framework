export interface UserGroup {
  user_id: bigint;
  group_id: bigint;

  assigned_at: Date;
  assigned_by?: bigint | null;
}
