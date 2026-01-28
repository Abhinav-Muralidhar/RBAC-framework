export interface AuthSession {
  id: string;

  user_id: string;

  session_token: string;

  expires_at: Date;

  ip_address: string;
  user_agent: string;

  login_at: Date;
  logout_at?: Date | null;
}
