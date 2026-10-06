/**
 * Auth Routes
 * 
 * Public authentication routes (login, logout).
 * These routes set signed cookies for session management.
 */

import { Router, Request, Response, CookieOptions, NextFunction } from 'express';
import { AuthSessionsRepository, TransactionTask } from '../repositories/auth_sessions.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { AuthSessionService } from '../services/authSession.service';
import { AuditService } from '../services/audit.service';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { hashPassword, verifyPassword } from '../../utils/crypto.utils';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { EvaluationService } from '../services/evaluation.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { IDatabase } from 'pg-promise';
import { UserService } from '../services/user.service';
import { PermissionService } from '../services/permission.service';
import { ProfilesRepository } from '../repositories/profiles.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { RoleRepository } from '../repositories/roles.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { PermissionEffect } from '../models/profile_permissions.model';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { PERMISSION_ACTIONS, PermissionAction } from '../models/permissions.model';
import { OtpService } from '../services/otp.service';
import { OtpTokenRepository } from '../repositories/otp_token.repository';
import { withTransaction } from '../../utils/transaction.utils';
import { badRequest, internalError, unauthorized } from '../errors/api.errors';
import { getRequiredBodyString } from './_paramUtils';
import { sendSuccess } from './_response';
// Cookie configuration
const COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

function resolveEffect(effects: PermissionEffect[]): PermissionEffect {
    if (effects.includes('deny')) return 'deny';
    if (effects.includes('allow')) return 'allow';
    return 'deny';
}
export function createAuthRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    // Repositories
    const sessionsRepo = new AuthSessionsRepository(db);
    const usersRepo = new UsersRepository(db);
    const auditLogsRepo = new AuditLogsRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const profilesRepository = new ProfilesRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const roleRepository = new RoleRepository(db);
    const evaluationService = new EvaluationService(
        new PermissionsRepository(db)
    );
    const userRolesRepository = new UserRoleRepository(db);

    // Services
    const auditService = new AuditService(auditLogsRepo, evaluationService, moduleRepository, usersRepo, roleRepository);
    const authSessionService = new AuthSessionService(sessionsRepo, usersRepo, auditService, evaluationService);
    const requireAuth = createAuthenticateMiddleware(authSessionService);
    const usersService = new UserService(usersRepo, userRolesRepository, evaluationService, auditService);
    const otpService = new OtpService(new OtpTokenRepository(db));

    /**
     * POST /auth/login
     * 
     * Authenticates user and sets session cookie.
     * Rate limited: 100 attempts per 15 minutes.
     */
    router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const username = getRequiredBodyString(req.body, 'username');
                const password = getRequiredBodyString(req.body, 'password');
                const user = await usersService.findByUsername(t, username.toLowerCase());
                if (!user) throw new Error('AUTH_FAILED');

                // Check user status
                if (user.status !== 'active') throw new Error('ACCOUNT_INACTIVE');
                const isValidPassword = await verifyPassword(password, user.password);
                if (!isValidPassword) throw new Error('AUTH_FAILED');

                // Create session using the service's create method
                const session = await authSessionService.create(t, {
                    user_id: user.id,
                    ip_address: req.ip || 'unknown',
                    user_agent: req.headers['user-agent'] || 'unknown'
                });
                // Update last login timestamp
                await usersService.recordLogin(t, user.id);

                const userResponse = await usersService.getById(t, user.id, user.id);

                return { session, userResponse };
            });
            // Set signed cookie with session token
            res.cookie('sessionToken', result.session.session_token, COOKIE_OPTIONS);
            sendSuccess(res, result.userResponse, { message: 'Login successful' });
        } catch (error: any) {
            if (error.message === 'AUTH_FAILED') {
                return next(unauthorized('Invalid username or password', 'AUTH_FAILED'));
            }
            if (error.message === 'ACCOUNT_INACTIVE') {
                return next(unauthorized('Account is not active', 'ACCOUNT_INACTIVE'));
            }
            console.error('Login error:', error);
            return next(internalError('Login failed'));
        }
    });

    /**
     * POST /auth/logout
     * 
     * Clears session cookie. Graceful - works even if not authenticated.
     */
    router.post('/logout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await withTransaction(db, async (t: TransactionTask) => {
                // Try to invalidate session if cookie exists
                // Fallback to unsigned cookie just in case, but usually signed.
                const sessionToken = req.signedCookies['sessionToken'] || req.cookies['sessionToken'];
                if (sessionToken) {
                    try {
                        const session = await authSessionService.resolveSession(t, sessionToken);
                        await authSessionService.logout(t, session.id, {
                            ip_address: req.ip || 'unknown',
                            user_agent: req.get('user-agent') || 'unknown'
                        } as any);
                    } catch (err) {
                        // If session not found or already invalid, just ignore it
                        console.warn('Logout resolution failed:', err);
                    }
                }
            });
            res.clearCookie('sessionToken', COOKIE_OPTIONS);
            sendSuccess(res, { message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout error:', error);
            res.clearCookie('sessionToken', COOKIE_OPTIONS);
            next(internalError('Logout failed'));
        }
    });

    // GET /rbac/users/me
    router.get('/users/me', requireAuth, async (req, res, next) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const userId = req.user!.id; // from session middleware

                const [user, modules] = await Promise.all([
                    usersService.getById(t, userId, userId),
                    moduleRepository.findAll(t)
                ]);

                const permissions: Record<
                    string,
                    Record<PermissionAction, PermissionEffect>
                > = {};

                const checks = modules.flatMap((module) =>
                    PERMISSION_ACTIONS.map(async (action) => {
                        const effects = await permissionsRepository.findEffectsByUserAndModuleAction(
                            t,
                            userId,
                            module.code,
                            action
                        );
                        return { moduleCode: module.code, action, effect: resolveEffect(effects) };
                    })
                );

                const resolved = await Promise.all(checks);

                for (const item of resolved) {
                    const modulePermissions =
                        permissions[item.moduleCode] ??
                        (permissions[item.moduleCode] = {} as Record<PermissionAction, PermissionEffect>);
                    modulePermissions[item.action] = item.effect;
                }
                return { user, permissions };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    return router;
}
