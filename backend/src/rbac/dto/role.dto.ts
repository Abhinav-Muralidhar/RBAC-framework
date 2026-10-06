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
    version: number;
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

/**
 * Role Response DTO with JOINed data
 * Includes human-readable names alongside IDs
 */
export interface RoleResponseDto {
    id: string;
    version: number;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;

    // Parent role (JOINed)
    parent_role_id: string | null;
    parent_role: {
        name: string;
        code: string;
    } | null;

    // Assigned profiles (JOINed with names)
    profiles: Array<{
        id: string;
        name: string;
        code: string;
    }>;

    // Counts
    user_count?: number;
    child_role_count?: number;

    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;  // JOINed: creator's name
    updated_at: Date | null;
    updated_by: string | null;
    updated_by_name: string | null;  // JOINed: updater's name
}

export interface RoleSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}

export type RoleNode = {
    id: string;
    name: string;
    children: RoleNode[];
    hasChildren: boolean;
};
