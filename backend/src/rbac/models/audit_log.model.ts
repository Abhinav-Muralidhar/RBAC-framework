export type AuditAction = 'create' | 'update' | 'delete' | 'export';
export type AuditStatus = 'success' | 'failure';

export interface AuditLog {
  id: bigint;

  user_id?: bigint;
  role_id?: bigint;

  action: AuditAction;

  module_id: bigint;

  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;

  ip_address: string;
  user_agent: string;

  status: AuditStatus;

  created_at: Date;
}
