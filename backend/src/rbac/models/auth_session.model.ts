export interface AuthSession {
  id: bigint;

  user_id: bigint;

  session_token: string;

  expires_at: Date;

  ip_address: string;
  user_agent: string;

  login_at: Date;
  logout_at?: Date | null;
}
