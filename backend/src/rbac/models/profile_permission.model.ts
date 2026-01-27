export type PermissionEffect = 'allow' | 'deny';

export interface ProfilePermission {
  profile_id: bigint;
  permission_id: bigint;

  effect: PermissionEffect;
}
