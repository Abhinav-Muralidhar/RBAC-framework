/**
 * Session Types
 */

export interface Session {
    id: string;
    user_id: string;
    username?: string | null;
    ip_address: string;
    user_agent: string;
    login_at: Date;
    logout_at: Date | null;
    expires_at: Date;
    is_active: boolean;
}

export interface SessionListFilterDto {
    user_id?: string;
    ip_address?: string;
    is_active?: boolean;
}