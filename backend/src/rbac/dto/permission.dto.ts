/**
 * Permission DTOs
 * 
 * Request, Response, and Filter DTOs for Permissions.
 */

import { PermissionAction } from '../models/permissions.model';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreatePermissionRequestDto {
    module_id: string;
    action: PermissionAction;
    description?: string;
    is_active?: boolean;
}

export interface UpdatePermissionRequestDto {
    description?: string | null;
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface PermissionResponseDto {
    id: string;
    module_id: string;
    action: PermissionAction;
    description: string | null;
    is_active: boolean;
}

export interface PermissionSummaryDto {
    id: string;
    module_id: string;
    action: PermissionAction;
    is_active: boolean;
}
