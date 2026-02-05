/**
 * Auth Routes
 * 
 * Public authentication routes (login, logout).
 * These routes set signed cookies for session management.
 */

import { Router, Request, Response, CookieOptions } from 'express';
import { AuthSessionsRepository, TransactionTask } from '../repositories/auth_sessions.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { AuthSessionService } from '../services/authSession.service';
import { AuditService } from '../services/audit.service';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { verifyPassword } from '../utils/crypto.utils';
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
import { withTransaction } from '../utils/transaction.utils';
// Cookie configuration
const COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

function sendError(res: Response, status: number, message: string, code?: string) {
    res.status(status).json({
        data: null,
        error: { message, code: code ?? 'ERROR' },
        meta: {}
    });
}
function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>) {
    res.json({ data, error: null, meta: meta ?? {} });
}
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
    const auditService = new AuditService(auditLogsRepo, evaluationService, moduleRepository);
    const authSessionService = new AuthSessionService(sessionsRepo, auditService, evaluationService);
    const requireAuth = createAuthenticateMiddleware(authSessionService);
    const usersService = new UserService(usersRepo, userRolesRepository, evaluationService, auditService);

    /**
     * POST /auth/login
     * 
     * Authenticates user and sets session cookie.
     * Rate limited: 5 attempts per 15 minutes.
     */
    router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.body.username || !req.body.password) {
                return sendError(res, 400, 'Username and password are required', 'VALIDATION_ERROR');
            }
            const result = await withTransaction(async (t: TransactionTask) => {
                const { username, password } = req.body;
                const user = await usersService.findByUsername(t, username);
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
                console.log('LOGIN TOKEN:', session.session_token);


                // Update last login
                await usersService.update(t, user.id, user.id, { last_login_at: new Date() });

                const userResponse = await usersService.getById(t, user.id, user.id);

                return { session, userResponse };
            });
            //CLEAR ANY PERVIOUS COOKIE
            res.clearCookie('sessionToken', COOKIE_OPTIONS);

            // Set signed cookie with session token
            res.cookie('sessionToken', result.session.session_token, COOKIE_OPTIONS);
            sendSuccess(res, result.userResponse, { message: 'Login successful' });
        } catch (error: any) {
            if (error.message === 'AUTH_FAILED') {
                return sendError(res, 401, 'Invalid username or password', 'AUTH_FAILED');
            }
            if (error.message === 'ACCOUNT_INACTIVE') {
                return sendError(res, 401, 'Account is not active', 'ACCOUNT_INACTIVE');
            }

            sendError(res, 500, 'Login failed', 'INTERNAL_ERROR');
        }
    });

    /**
     * POST /auth/logout
     * 
     * Clears session cookie. Graceful - works even if not authenticated.
     */
    router.post('/logout', async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                // Try to invalidate session if cookie exists
                const sessionToken = req.signedCookies['sessionToken'];
                if (sessionToken) {
                    await withTransaction(async (t) => {
                        const session = await authSessionService.resolveSession(t, sessionToken);
                        await authSessionService.logout(t, session.id);
                    });
                }
            });
            res.clearCookie('sessionToken', COOKIE_OPTIONS);
            sendSuccess(res, { message: 'Logged out successfully' });
        } catch (error) {
            sendError(res, 500, 'Logout failed', 'INTERNAL_ERROR');
            res.clearCookie('sessionToken', COOKIE_OPTIONS);
        }
    });

    // GET /rbac/users/me
    router.get('/users/me', requireAuth, async (req, res) => {
        const result = await withTransaction(async (t: TransactionTask) => {
            const userId = req.user!.id; // from session middleware

            const user = await usersService.getById(t, userId, userId);
            const modules = await moduleRepository.findAll();

            const permissions: Record<
                string,
                Record<PermissionAction, PermissionEffect>
            > = {};

            for (const module of modules) {
                const modulePermissions: Record<
                    PermissionAction,
                    PermissionEffect
                > = {} as Record<PermissionAction, PermissionEffect>;

                for (const action of PERMISSION_ACTIONS) {
                    const effects =
                        await permissionsRepository.findEffectsByUserAndModuleAction(
                            undefined,
                            userId,
                            module.code,
                            action
                        );

                    modulePermissions[action] = resolveEffect(effects);
                }

                permissions[module.code] = modulePermissions;
            }
            return { user, permissions };
        });
        sendSuccess(res, result);
    });
    return router;
}
