export interface AuthSessions {
  id: string;

  user_id: string;

  session_token: string;

  expires_at: Date;

  ip_address: string;
  user_agent: string;

  login_at: Date;
  logout_at?: Date | null;
}

export interface AuthSessionWithUsername extends AuthSessions {
  username: string | null;
}
