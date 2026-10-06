/**
 * Audit Log DTOs
 * 
 * Request, Response, and Filter DTOs for Audit Logs.
 */

import { AuditAction, AuditStatus } from '../models/audit_logs.model';

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface AuditLogListFilterDto {
    user_id?: string;
    user_name?: string;
    action?: AuditAction;
    entity_type?: string;
    entity_id?: string;
    status?: AuditStatus;
    start_date?: Date;
    end_date?: Date;
    search?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Full Audit Log Response DTO with JOINed data
 * Includes human-readable names alongside IDs
 */
export interface AuditLogResponseDto {
    id: string;

    // User context (JOINed)
    user_id: string | null;
    user_name: string | null;        // JOINed: first_name + ' ' + last_name
    user_email: string | null;       // JOINed: primary_email

    // Role context (JOINed)
    role_id: string | null;
    role_name: string | null;        // JOINed: roles.name

    // Action info
    action: AuditAction;

    // Module context (JOINed)
    module_id: string;
    module_name: string | null;      // JOINed: modules.name
    module_code: string | null;      // JOINed: modules.code

    // Entity info
    entity_type: string;
    entity_id: string;

    // Change data
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;

    // Request context
    ip_address: string;
    user_agent: string;

    status: AuditStatus;
    created_at: Date;
}

/**
 * Minimal audit log summary for lists
 */
export interface AuditLogSummaryDto {
    id: string;
    action: AuditAction;
    entity_type: string;
    entity_id: string | null;
    user_name: string | null;    // JOINed for quick reference
    user_email: string | null;
    status: AuditStatus;
    ip_address: string;
    created_at: Date;
}

