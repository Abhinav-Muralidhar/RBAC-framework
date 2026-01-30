/**
 * Audit Log DTOs
 * 
 * Request, Response, and Filter DTOs for Audit Logs.
 */

import { AuditAction, AuditStatus } from '../models/audit_logs.model';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateAuditLogRequestDto {
    user_id?: string;
    role_id?: string;
    action: AuditAction;
    module_id?: string;
    entity_type?: string;
    entity_id?: string;
    old_values?: Record<string, unknown> | null;
    new_values?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    status: AuditStatus;
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

export interface AuditLogResponseDto {
    id: string;
    user_id: string | null;
    role_id: string | null;
    action: AuditAction;
    module_id: string;
    entity_type: string;
    entity_id: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string;
    user_agent: string;
    status: AuditStatus;
    created_at: Date;
}

export interface AuditLogSummaryDto {
    id: string;
    action: AuditAction;
    entity_type: string;
    status: AuditStatus;
    created_at: Date;
}
