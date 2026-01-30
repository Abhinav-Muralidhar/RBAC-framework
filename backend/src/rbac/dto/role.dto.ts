/**
 * Role DTOs
 * 
 * Request, Response, and Filter DTOs for Roles.
 */

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateRoleRequestDto {
    name: string;
    code: string;
    description?: string;
    parent_role_id?: string;
    is_active?: boolean;
    profile_ids?: string[];  // Profiles to assign
}

export interface UpdateRoleRequestDto {
    name?: string;
    code?: string;
    description?: string | null;
    parent_role_id?: string | null;
    is_active?: boolean;
    profile_ids?: string[];  // Replace all profiles
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface RoleListFilterDto {
    is_active?: boolean;
    parent_role_id?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface RoleResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | null;
    parent_role_id: string | null;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
    profile_ids: string[];
}

export interface RoleSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}
