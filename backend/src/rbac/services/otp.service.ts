import { IOtpTokenRepository } from '../repositories/otp_token.repository';
import { OtpTokens } from '../models/otp_tokens.model';
import { TransactionTask } from '../utils/transaction.utils';
import { CreateOtpTokenInput } from '../types/repository.types';
import { verifyPassword } from '../utils/crypto.utils';

const MAX_OTP_GENERATE = 6;          // Maximum OTPs per user
const OTP_EXPIRY_MINUTES = 5;        // OTP validity duration

export interface IOtpService {
  generateOtp(t: TransactionTask, userId: string, sentTo: string, otpHash: string, ipAddress?: string, userAgent?: string): Promise<OtpTokens>;
  validateOtp(t: TransactionTask, userId: string, otpHash: string): Promise<boolean>;
  cleanupExpiredOtps(t: TransactionTask): Promise<void>;
}

export class OtpService implements IOtpService {
  constructor(private otpRepo: IOtpTokenRepository) { }

  async generateOtp(t: TransactionTask, userId: string, sentTo: string, otpHash: string, ipAddress = '', userAgent = ''): Promise<OtpTokens> {
    // 1. Cleanup expired OTPs
    await this.otpRepo.deleteExpired(t);

    // 2. Count OTPs in the last X minutes
    const recentOtpCount = await this.otpRepo.countRecentOtps(userId, OTP_EXPIRY_MINUTES, t);
    if (recentOtpCount >= MAX_OTP_GENERATE) {
      throw new Error(`Maximum OTP generation attempts (${MAX_OTP_GENERATE}) reached`);
    }
    // 3. Prepare new OTP
    const input: CreateOtpTokenInput = {
      user_id: userId,
      otp_hash: otpHash,
      sent_to: sentTo,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      ip_address: ipAddress,
      user_agent: userAgent,
      attempt_count: 1 // new OTP starts with 1
    };

    // 4. Insert new OTP atomically
    return this.otpRepo.create(input, t);
  }

  async validateOtp(t: TransactionTask, userId: string, otpHash: string): Promise<boolean> {
    const valiasd = await this.otpRepo.findLatestByUser(userId, t);
    if ((valiasd?.attempt_count ?? 0) >= 5) {
      throw new Error(`Maximum OTP generation attempts (${MAX_OTP_GENERATE}) reached`);
    }
    if (!await verifyPassword(valiasd?.otp_hash ?? '', otpHash)) {
      const count = await this.otpRepo.incrementAttempts(userId, t);
      return false;
    }
    return true;
  }


  /** Optional: manually clean expired OTPs */
  async cleanupExpiredOtps(t: TransactionTask): Promise<void> {
    await this.otpRepo.deleteExpired(t);
  }
}
