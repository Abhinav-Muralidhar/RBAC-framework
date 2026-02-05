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
export function createOtpRouter(db: IDatabase<unknown>, auditService: AuditService, evaluationService: EvaluationService, userService: UserService, otpService: OtpService): Router {
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

                return { message: 'OTP sent successfully' };
            });
            sendSuccess(res, result);
        } catch (error: any) {
            next(error);
        }
    });

    /**
     * POST /auth/otp/verify
     * Request body: { email: string, code: string }
     * Verify the OTP
     */
    router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {

                const email = req.body.email;
                const code = req.body.code;

                if (!email || typeof email !== 'string') {
                    const err = new Error('Email is required and must be a string');
                    (err as any).status = 400;
                    throw err;
                }
                if (!code || typeof code !== 'string') {
                    const err = new Error('OTP code is required and must be a string');
                    (err as any).status = 400;
                    throw err;
                }

                const success = await otpService.validateOtp(t, email, code);
                if (!success) {
                    const err = new Error('Invalid or expired OTP');
                    (err as any).status = 400;
                    throw err;
                }

                return { otp: code, message: 'OTP verified successfully' };
            });
            sendSuccess(res, result);
        } catch (error: any) {
            next(error);
        }
    });

    return router;
}
