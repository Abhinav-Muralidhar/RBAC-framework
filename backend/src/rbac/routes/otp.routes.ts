import { Router, Request, Response, NextFunction } from 'express';
import { OtpService } from '../services/otp.service';
import { IDatabase } from 'pg-promise';
import { OtpTokenRepository } from '../repositories/otp_token.repository';
import { UserService } from '../services/user.service';
import { UsersRepository } from '../repositories/users.repository';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { hashPassword } from '../utils/crypto.utils';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';
import { error } from 'node:console';
import { EmailService } from '../services/email.service';
import { SmtpConfigService } from '../services/smtpConfig.service';

/**
 * Standard response helpers
 */
function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>) {
    res.json({ data, error: null, meta: meta ?? {} });
}

function sendError(res: Response, status: number, message: string, code?: string) {
    res.status(status).json({
        data: null,
        error: { message, code: code ?? 'ERROR' },
        meta: {}
    });
}
function generateAlphaNumericOtp(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return otp;
}

/**
 * OTP router
 */
export function createOtpRouter(db: IDatabase<unknown>, auditService: AuditService, evaluationService: EvaluationService, userService: UserService, otpService: OtpService, smtpService: SmtpConfigService): Router {
    const router = Router();
    /**
     * POST /auth/otp/send
     * Request body: { email: string }
     * Generate and send a new OTP
     */
    router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const email = req.body.email;
                if (!email || typeof email !== 'string') {
                    const err = new Error('Email is required and must be a string');
                    (err as any).status = 400;
                    throw err;
                }
                const user = await userService.findByEmail(t, email);
                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }
                const otpCode = generateAlphaNumericOtp(6);
                const otpHash = await hashPassword(otpCode);


                await otpService.generateOtp(t, user.id, email, otpHash);

                // In real implementation, send OTP via email or SMS here
                // ✅ SEND EMAIL
                const smtpConfig = await smtpService.getActive(t);
                const emailService = new EmailService(smtpConfig);

                await emailService.sendMail(
                    {
                        to: email,
                        subject: 'Your OTP Code',
                        html: `
                            <h2>OTP Verification</h2>
                            <p>Your OTP is:</p>
                            <h1>${otpCode}</h1>
                            <p>Valid for 5 minutes</p>
                        `
                    },
                    {
                        from_email: smtpConfig.from_email ?? null,
                        from_name: smtpConfig.from_name ?? null,
                        reply_to_email: smtpConfig.reply_to_email ?? null
                    }
                );

                return { message: 'OTP sent successfully' };
            });
            sendSuccess(res, result);
        } catch (error: any) {
            next(error);
        }
    });

    /**
     * POST /auth/otp/verify
     * Request body: { email: string, otp: string }
     * Verify the OTP
     */
    router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const email = req.body.email;
                const otp = req.body.otp;

                if (!email || typeof email !== 'string') {
                    const err = new Error('Email is required and must be a string');
                    (err as any).status = 400;
                    throw err;
                }
                if (!otp || typeof otp !== 'string') {
                    const err = new Error('OTP code is required and must be a string');
                    (err as any).status = 400;
                    throw err;
                }

                const success = await otpService.validateOtp(t, email, otp);
                if (!success) {
                    const err = new Error('Invalid or expired OTP');
                    (err as any).status = 400;
                    throw err;
                }
                return { message: 'OTP verified successfully' };
            });
            sendSuccess(res, result);
        } catch (error: any) {
            next(error);
        }
    });



    router.post('/password/reset', async (req, res, next) => {
        try {
            const result = await withTransaction(async (t) => {

                const { email, otp, newPassword } = req.body;

                if (!email || !otp || !newPassword) {
                    const err = new Error('email, otp and newPassword required');
                    (err as any).status = 400;
                    throw err;
                }

                const user = await userService.findByEmail(t, email);

                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }

                // ✅ verify OTP
                const valid = await otpService.validateOtp(t, email, otp);
                if (!valid) {
                    const err = new Error('Invalid or expired OTP');
                    (err as any).status = 400;
                    throw err;
                }

                const hashed = await hashPassword(newPassword);

                await userService.updatePassword(t, user.id, hashed);
                // ✅ delete OTP after successful password update
                await otpService.deleteOtp(t, user.id);

                return { message: 'Password updated successfully' };
            });

            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    });




    return router;
}
