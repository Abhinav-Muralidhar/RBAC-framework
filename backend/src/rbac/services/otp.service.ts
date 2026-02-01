import { IOtpTokenRepository } from '../repositories/otp_token.repository';
import { OtpTokens } from '../models/otp_tokens.model';

const MAX_OTP_GENERATE = 5;          // Maximum OTPs per user
const OTP_EXPIRY_MINUTES = 5;        // OTP validity duration

export class OtpService {
  constructor(private otpRepo: IOtpTokenRepository) { }

  /** Generate a new OTP for a user */
  async generateOtp(userId: string, sentTo: string, otpHash: string): Promise<OtpTokens> {
    // 1. Cleanup expired OTPs first (on-demand)
    await this.otpRepo.deleteExpired();

    // 2. Fetch latest OTP to check attempt count
    const latest = await this.otpRepo.findLatestByUser(userId);

    if (latest && latest.attempt_count >= MAX_OTP_GENERATE) {
      throw new Error(`Maximum OTP generation attempts (${MAX_OTP_GENERATE}) reached`);
    }

    // 3. Prepare new OTP data - strict input type
    const input = {
      user_id: userId,
      otp_hash: otpHash,
      sent_to: sentTo,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      ip_address: '',      // Can be passed in if you track
      user_agent: '',      // Can be passed in if you track
      attempt_count: latest ? latest.attempt_count + 1 : 1
    };

    // 4. Insert new OTP
    return await this.otpRepo.create(input);
  }

  /** Validate an OTP and delete it if valid */
  async validateOtp(userId: string, otpHash: string): Promise<boolean> {
    // Optionally, cleanup expired OTPs first
    await this.otpRepo.deleteExpired();

    // Atomically check & delete OTP
    const success = await this.otpRepo.deleteOnSuccess(userId, otpHash);

    if (!success) {
      // OTP invalid or expired
      return false;
    }

    // OTP existed and deleted → success
    return true;
  }

  /** Optional: manually clean expired OTPs */
  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepo.deleteExpired();
  }
}
