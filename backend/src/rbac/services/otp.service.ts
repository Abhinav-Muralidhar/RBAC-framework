import { IOtpTokenRepository } from '../repositories/otp_token.repository';
import { OtpTokens } from '../models/otp_tokens.model';
import { TransactionTask } from '../../utils/transaction.utils';
import { CreateOtpTokenInput } from '../types/repository.types';
import { verifyPassword } from '../../utils/crypto.utils';
import { assertRequiredString, assertRequiredEmail, assertOtpCode } from '../../utils/validators';

const MAX_OTP_GENERATE = 6;          // Maximum OTPs per user
const OTP_EXPIRY_MINUTES = 5;        // OTP validity duration
const MAX_OTP_VERIFY_ATTEMPTS = 5;

export interface IOtpService {
  /** Generate and store a new OTP for a user, enforcing rate limits. */
  generateOtp(t: TransactionTask, userId: string, sentTo: string, otpHash: string, ipAddress?: string, userAgent?: string): Promise<OtpTokens>;
  /** Validate a given OTP for a user, checking expiry and attempt limits. */
  validateOtp(t: TransactionTask, sentTo: string, otp: string, deleteOnSuccess?: boolean): Promise<boolean>;
  /** Remove all expired OTP entries from the database. */
  cleanupExpiredOtps(t: TransactionTask): Promise<void>;
  /** Delete any existing OTPs for a specific user. */
  deleteOtp(t: TransactionTask, userId: string): Promise<void>;
}

export class OtpService implements IOtpService {
  constructor(private otpRepo: IOtpTokenRepository) { }

  async generateOtp(t: TransactionTask, userId: string, sentTo: string, otpHash: string, ipAddress = '', userAgent = ''): Promise<OtpTokens> {
    assertRequiredString(userId, 'User ID');
    assertRequiredEmail(sentTo, 'Email');
    assertRequiredString(otpHash, 'OTP hash');

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

  async validateOtp(
    t: TransactionTask,
    sentTo: string,
    otp: string,
    deleteOnSuccess = false
  ): Promise<boolean> {
    assertRequiredEmail(sentTo, 'Email');
    assertOtpCode(otp, 'OTP');
    await this.otpRepo.deleteExpired(t);

    const record = await this.otpRepo.findLatestBySentTo(sentTo, t);

    if (!record) return false;

    // expired
    if (record.expires_at < new Date()) return false;

    // too many attempts
    if ((record.attempt_count ?? 0) >= MAX_OTP_VERIFY_ATTEMPTS) return false;

    const match = await verifyPassword(otp, record.otp_hash);

    if (!match) {
      await this.otpRepo.incrementAttempts(record.id, t);
      return false;
    }

    if (deleteOnSuccess) {
      await this.otpRepo.deleteById(record.id, t);
    }
    return true;
  }

  async deleteOtp(t: TransactionTask, userId: string): Promise<void> {
    await this.otpRepo.delete(userId, t);
  }


  /** Optional: manually clean expired OTPs */
  async cleanupExpiredOtps(t: TransactionTask): Promise<void> {
    await this.otpRepo.deleteExpired(t);
  }
}
