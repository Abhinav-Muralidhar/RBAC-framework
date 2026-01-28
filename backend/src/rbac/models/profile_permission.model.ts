export type PermissionEffect = 'allow' | 'deny';

export interface ProfilePermission {
  profile_id: string;
  permission_id: string;

  effect: PermissionEffect;
}
