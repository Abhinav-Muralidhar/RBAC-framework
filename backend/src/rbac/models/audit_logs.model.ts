export type AuditAction = 'create' | 'update' | 'delete' | 'export';
export type AuditStatus = 'success' | 'failure';

export interface AuditLogs {
  id: string;

  user_id: string | null;
  role_id: string | null;

  action: AuditAction;
  entity_type: string;
  entity_id: string;
  module_id: string | null;

  old_values: unknown | null;
  new_values: unknown | null;

  ip_address: string;
  user_agent: string;

  status: AuditStatus;

  created_at: Date;
}
