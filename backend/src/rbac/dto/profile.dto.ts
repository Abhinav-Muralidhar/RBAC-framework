/**
 * Profile DTOs
 * 
 * Request, Response, and Filter DTOs for Profiles.
 */

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

export interface ProfileResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
    permissions: ProfilePermissionFlagDto[];
}

export interface ProfilePermissionFlagDto {
    permissionId: string;
    allowed: boolean;
}

export interface ProfileSummaryDto {
    id: string;
    name: string;
    description?: string;
    code: string;
    is_active: boolean;
}
