export type AuditAction = 'create' | 'update' | 'delete' | 'export';
export type AuditStatus = 'success' | 'failure';

export interface AuditLog {
  id: string;

  user_id?: string;
  role_id?: string;

  action: AuditAction;

  module_id: string;

  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;

  ip_address: string;
  user_agent: string;

  status: AuditStatus;

  created_at: Date;
}
