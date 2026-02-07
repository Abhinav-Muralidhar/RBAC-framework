export interface OtpTokens {
  id: string;

  user_id: string;

  otp_hash: string;

  expires_at: Date;

  attempt_count: number;

  sent_to: string;

  ip_address: string;
  user_agent: string;

  created_at: Date;
}
