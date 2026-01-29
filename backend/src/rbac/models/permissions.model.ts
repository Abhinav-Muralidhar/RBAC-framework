export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export';

export interface Permissions {
  id: string;

  module_id: string;
  action: PermissionAction;

  description?: string | null;
  is_active: boolean;
}
