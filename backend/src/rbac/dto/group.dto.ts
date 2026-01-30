/**
 * Group DTOs
 * 
 * Request, Response, and Filter DTOs for Groups.
 */

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateGroupRequestDto {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
    role_ids?: string[];  // Roles to assign
}

export interface UpdateGroupRequestDto {
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
    role_ids?: string[];  // Replace all roles
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface GroupListFilterDto {
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface GroupResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
    role_ids: string[];
}

export interface GroupSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}
