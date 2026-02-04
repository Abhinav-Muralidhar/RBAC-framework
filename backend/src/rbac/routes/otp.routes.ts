import { Router, Request, Response, NextFunction } from 'express';
import { IOtpService, OtpService } from '../services/otp.service';
import { getRequiredParam } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { OtpTokenRepository } from '../repositories/otp_token.repository';
import { IUserService, UserService } from '../services/user.service';
import { UsersRepository } from '../repositories/users.repository';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { UserNotFoundError } from '../errors/rbac.errors';
import { validatePassword, hashPassword } from '../utils/crypto.utils';
import { UserRoleRepository } from '../repositories/user_roles.repository';

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
export function createOtpRouter(db: IDatabase<unknown>, auditService: AuditService): Router {
    const router = Router();
    // Initialize repositories
    const usersRepository = new UsersRepository(db);
    const permissionsRepository = new PermissionsRepository(db);

    // Initialize services
    const evaluationService = new EvaluationService(
        permissionsRepository

    );
    const userRolesRepository = new UserRoleRepository(db);
    const userService = new UserService(usersRepository, userRolesRepository, evaluationService, auditService);
    const otpTokenRepository = new OtpTokenRepository(db);
    const otpService = new OtpService(otpTokenRepository);
    /**
     * POST /auth/otp/send
     * Request body: { email: string }
     * Generate and send a new OTP
     */
    router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const email = req.body.email;
            if (!email || typeof email !== 'string') {
                return sendError(res, 400, 'Email is required and must be a string');
            }
            const user = await userService.findByEmail(email);
            if (!user) {
                throw sendError(res, 404, 'User not found');
            }
            const otpCode = generateAlphaNumericOtp(6);
            const otpHash = await hashPassword(otpCode);


            await otpService.generateOtp(user.id, email, otpHash);

            // In real implementation, send OTP via email or SMS here

            sendSuccess(res, { message: 'OTP sent successfully' });
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
            const email = req.body.email;
            const code = req.body.code;

            if (!email || typeof email !== 'string') {
                return sendError(res, 400, 'Email is required and must be a string');
            }
            if (!code || typeof code !== 'string') {
                return sendError(res, 400, 'OTP code is required and must be a string');
            }

            const success = await otpService.validateOtp(email, code);
            if (!success) {
                return sendError(res, 400, 'Invalid or expired OTP');
            }

            sendSuccess(res, { otp: code, message: 'OTP verified successfully' });
        } catch (error: any) {
            next(error);
        }
    });

    return router;
}
