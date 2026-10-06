import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { AuditService } from '../services/audit.service';
import { hashPassword, validatePassword } from '../../utils/crypto.utils';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
import { EmailService } from '../services/email.service';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { OtpService } from '../services/otp.service';
import { UserService } from '../services/user.service';
import { authLimiter, strictLimiter } from '../middleware/rateLimit.middleware';
import { getBodyObject, getRequiredBodyString } from './_paramUtils';
import { sendSuccess } from './_response';

const MODULE_CODE = 'SETTINGS';

function generateAlphaNumericOtp(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let otp = '';

    for (let i = 0; i < length; i++) {
        otp += chars[bytes[i]! % chars.length];
    }

    return otp;
}

export function createOtpRouter(
    db: IDatabase<unknown>,
    auditService: AuditService,
    _evaluationService: unknown,
    userService: UserService,
    otpService: OtpService,
    smtpService: SmtpConfigService
): Router {
    const router = Router();

    router.post('/send', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const email = getRequiredBodyString(req.body, 'email');

                const user = await userService.findByEmail(t, email);
                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }

                const otpCode = generateAlphaNumericOtp(6);
                const otpHash = await hashPassword(otpCode);

                await otpService.generateOtp(
                    t,
                    user.id,
                    email,
                    otpHash,
                    req.ip,
                    req.get('user-agent') ?? 'unknown'
                );

                await auditService.log(t, {
                    user_id: user.id,
                    action: 'create',
                    module_code: MODULE_CODE,
                    entity_type: 'otp',
                    entity_id: user.id,
                    old_values: null,
                    new_values: { sent_to: email, channel: 'email' },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'success'
                });

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
                            <p>If you did not request this code, ignore this email.</p>
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
        } catch (error) {
            next(error);
        }
    });

    router.post('/verify', strictLimiter, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const email = getRequiredBodyString(req.body, 'email');
                const otp = getRequiredBodyString(req.body, 'otp');

                const success = await otpService.validateOtp(t, email, otp, false);
                if (!success) {
                    await auditService.log(t, {
                        action: 'update',
                        module_code: MODULE_CODE,
                        entity_type: 'otp',
                        entity_id: email,
                        old_values: null,
                        new_values: { sent_to: email, result: 'verification_failed' },
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                        status: 'failure'
                    });

                    const err = new Error('Invalid or expired OTP');
                    (err as any).status = 400;
                    throw err;
                }

                await auditService.log(t, {
                    action: 'update',
                    module_code: MODULE_CODE,
                    entity_type: 'otp',
                    entity_id: email,
                    old_values: null,
                    new_values: { sent_to: email, result: 'verified' },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'success'
                });

                return { message: 'OTP verified successfully' };
            });

            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    router.post('/password/reset', authLimiter, async (req, res, next) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const body = getBodyObject(req.body);
                const email = getRequiredBodyString(body, 'email');
                const otp = getRequiredBodyString(body, 'otp');
                const newPassword = getRequiredBodyString(body, 'newPassword');

                validatePassword(newPassword);

                const user = await userService.findByEmail(t, email);
                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }

                const valid = await otpService.validateOtp(t, email, otp, true);
                if (!valid) {
                    await auditService.log(t, {
                        user_id: user.id,
                        action: 'update',
                        module_code: MODULE_CODE,
                        entity_type: 'password_reset',
                        entity_id: user.id,
                        old_values: null,
                        new_values: { sent_to: email, result: 'otp_failed' },
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                        status: 'failure'
                    });

                    const err = new Error('Invalid or expired OTP');
                    (err as any).status = 400;
                    throw err;
                }

                const hashed = await hashPassword(newPassword);
                await userService.updatePassword(t, user.id, hashed, {
                    request_id: req.requestId ?? 'unknown',
                    user_id: user.id,
                    session_id: null,
                    ip_address: req.ip ?? req.socket.remoteAddress ?? 'unknown',
                    user_agent: req.get('user-agent') ?? 'unknown',
                    timestamp: new Date(),
                });
                await otpService.deleteOtp(t, user.id);

                await auditService.log(t, {
                    user_id: user.id,
                    action: 'update',
                    module_code: MODULE_CODE,
                    entity_type: 'password_reset',
                    entity_id: user.id,
                    old_values: null,
                    new_values: { sent_to: email, reset: true },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'success'
                });

                return { message: 'Password updated successfully' };
            });

            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
