export const PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'export',
] as const;

export type PermissionAction = typeof PERMISSION_ACTIONS[number];

export interface Permissions {
  id: string;

  module_id: string;
  action: PermissionAction;

  description?: string | null;
  is_active: boolean;
}
