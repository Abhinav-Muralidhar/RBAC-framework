/**
 * Audit Log Types
 */

export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'export' | 'login' | 'logout';
export type AuditStatus = 'success' | 'failure' | 'denied';

export interface AuditLog {
    id: string;
    action: AuditAction;
    entity_type: string;
    entity_id: string;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    role_id: string | null;
    role_name: string | null;
    module_id: string | null;
    module_name: string | null;
    module_code: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string;
    user_agent: string;
    status: AuditStatus;
    created_at: string;
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface AuditLogListFilterDto {
    user_id?: string;
    action?: AuditAction;
    entity_type?: string;
    entity_id?: string;
    status?: AuditStatus;
    start_date?: Date;
    end_date?: Date;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Minimal audit log summary for lists
 */
export interface AuditLogSummaryDto {
    id: string;
    action: AuditAction;
    entity_type: string;
    user_name: string | null;
    status: AuditStatus;
    created_at: Date;
}