/**
 * Auth Session DTOs
 * 
 * Request, Response, and Filter DTOs for Auth Sessions.
 */

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateAuthSessionRequestDto {
    user_id: string;
    ip_address?: string;
    user_agent?: string;
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface AuthSessionListFilterDto {
    user_id?: string;
    is_active?: boolean;  // logout_at is null and not expired
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface AuthSessionResponseDto {
    id: string;
    user_id: string;
    session_token: string;
    username?: string | null;
    ip_address: string;
    user_agent: string;
    login_at: Date;
    logout_at: Date | null;
    expires_at: Date;
    is_active: boolean;  // Computed: logout_at is null and expires_at > now
}

export interface AuthSessionSummaryDto {
    id: string;
    user_id: string;
    login_at: Date;
    is_active: boolean;
}

export interface AuthSessionListItemDto {
    id: string;
    user_id: string;
    username: string | null;
    session_token: string;
    ip_address: string;
    user_agent: string;
    login_at: Date;
    logout_at: Date | null;
    expires_at: Date;
    is_active: boolean;
}
