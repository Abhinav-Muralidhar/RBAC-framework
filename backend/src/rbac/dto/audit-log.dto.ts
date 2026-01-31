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
    user_name: string | null;    // JOINed for quick reference
    status: AuditStatus;
    created_at: Date;
}

