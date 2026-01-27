export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export';

export interface Permission {
  id: bigint;

  module_id: bigint;
  action: PermissionAction;

  description?: string | null;
  is_active: boolean;
}
