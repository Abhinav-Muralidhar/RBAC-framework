export type AuditAction = 'create' | 'update' | 'delete' | 'export';
export type AuditStatus = 'success' | 'failure';

export interface AuditLogs {
  id: string;

  user_id?: string;
  role_id?: string;

  action: AuditAction;
  entity_type: string;
  entity_id: string;
  module_id: string;

  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;

  ip_address: string;
  user_agent: string;

  status: AuditStatus;

  created_at: Date;
}
