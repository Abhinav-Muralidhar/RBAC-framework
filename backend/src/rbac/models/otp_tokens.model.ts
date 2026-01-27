export interface OtpToken {
  id: bigint;

  user_id: bigint;

  otp_hash: string;

  expires_at: Date;

  attempt_count: number;

  sent_to: string;

  ip_address: string;
  user_agent: string;

  created_at: Date;
}
