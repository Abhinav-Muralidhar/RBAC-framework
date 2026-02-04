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

/**
 * Group Response DTO with JOINed data
 * Includes human-readable role names
 */
export interface GroupResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;

    // Assigned roles (JOINed with names)
    roles: Array<{
        id: string;
        name: string;
        code: string;
    }>;
    users: Array<{
        id: string;
        name: string;
    }>;

    // User count in this group
    user_count?: number;

    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;  // JOINed: creator's name
}

export interface GroupSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}

