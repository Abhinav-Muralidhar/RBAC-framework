/**
 * Profile DTOs
 * 
 * Request, Response, and Filter DTOs for Profiles.
 */

import { PermissionEffect } from '../models/profile_permissions.model';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateProfileRequestDto {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
    permission_ids?: string[];  // Permissions to assign
}

export interface UpdateProfileRequestDto {
    version: number;
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
    permission_ids?: string[];  // Replace all permissions
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface ProfileListFilterDto {
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Profile Response DTO with JOINed data
 * Includes human-readable permission and module names
 */
export interface ProfileResponseDto {
    id: string;
    version: number;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;

    // Assigned permissions (JOINed with module info)
    permissions: Array<{
        id: string;
        action: string;              // e.g., 'read', 'create', 'update', 'delete'
        effect: PermissionEffect;    // 'allow' or 'deny'
        module_id: string;
        module_name: string;         // JOINed: modules.name
        module_code: string;         // JOINed: modules.code
    }>;

    // Role count using this profile
    role_count?: number;

    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;  // JOINed: creator's name
    updated_at: Date | null;
    updated_by: string | null;
    updated_by_name: string | null;  // JOINed: updater's name
}

export interface ProfileSummaryDto {
    id: string;
    name: string;
    description?: string;
    code: string;
    is_active: boolean;
}

