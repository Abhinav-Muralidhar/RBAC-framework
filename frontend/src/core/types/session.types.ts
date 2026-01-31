/**
 * Session Types
 */

export interface Session {
    id: string;
    user_id: string;
    login_at: string;
    expires_at: string;
    ip_address: string;
    user_agent: string;
}
