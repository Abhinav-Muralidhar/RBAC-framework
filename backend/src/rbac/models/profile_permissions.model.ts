export type PermissionEffect = 'allow' | 'deny';

export interface ProfilePermissions {
  profile_id: string;
  permission_id: string;

  effect: PermissionEffect;
}
