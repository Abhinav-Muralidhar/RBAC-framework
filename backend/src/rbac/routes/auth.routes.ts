/**
 * Auth Routes
 * 
 * Public authentication routes (login, logout).
 * These routes set signed cookies for session management.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { AuthSessionService } from '../services/authSession.service';
import { AuditService } from '../services/audit.service';
import { authLimiter } from '../middleware/rateLimit.middleware';

// Cookie configuration
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

export function createAuthRouter(pool: Pool): Router {
    const router = Router();

    // Repositories
    const sessionsRepo = new AuthSessionsRepository(pool);
    const usersRepo = new UsersRepository(pool);
    const auditLogsRepo = new AuditLogsRepository(pool);

    // Services
    const auditService = new AuditService(auditLogsRepo);
    const authSessionService = new AuthSessionService(sessionsRepo, auditService);

    /**
     * POST /auth/login
     * 
     * Authenticates user and sets session cookie.
     * Rate limited: 5 attempts per 15 minutes.
     */
    router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                res.status(400).json({
                    data: null,
                    error: { message: 'Username and password are required', code: 'VALIDATION_ERROR' },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }

            // Find user by username
            const user = await usersRepo.findByUsername(username);
            if (!user) {
                res.status(401).json({
                    data: null,
                    error: { message: 'Invalid username or password', code: 'AUTH_FAILED' },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }

            // Check user status
            if (user.status !== 'active') {
                res.status(401).json({
                    data: null,
                    error: { message: 'Account is not active', code: 'ACCOUNT_INACTIVE' },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }

            // Verify password (assuming plain text comparison for now - should use bcrypt in production)
            // TODO: Replace with bcrypt.compare(password, user.password)
            const isValidPassword = password === user.password;
            if (!isValidPassword) {
                res.status(401).json({
                    data: null,
                    error: { message: 'Invalid username or password', code: 'AUTH_FAILED' },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }

            // Create session using the service's create method
            const session = await authSessionService.create({
                user_id: user.id,
                ip_address: req.ip || 'unknown',
                user_agent: req.headers['user-agent'] || 'unknown'
            });

            // Set signed cookie with session token
            res.cookie('sessionId', session.session_token, COOKIE_OPTIONS);

            // Update last login
            await usersRepo.update(user.id, { last_login_at: new Date() });

            res.status(200).json({
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        primary_email: user.primary_email,
                        status: user.status,
                    },
                    message: 'Login successful'
                },
                error: null,
                meta: { timestamp: new Date().toISOString() }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                data: null,
                error: { message: 'Login failed', code: 'INTERNAL_ERROR' },
                meta: { timestamp: new Date().toISOString() }
            });
        }
    });

    /**
     * POST /auth/logout
     * 
     * Clears session cookie. Graceful - works even if not authenticated.
     */
    router.post('/logout', async (req: Request, res: Response): Promise<void> => {
        try {
            // Try to invalidate session if cookie exists
            const sessionToken = req.signedCookies['sessionId'];
            if (sessionToken) {
                try {
                    // Find session by token and logout
                    const session = await authSessionService.resolveSession(sessionToken);
                    if (session) {
                        await authSessionService.logout(session.id);
                    }
                } catch {
                    // Ignore errors - session may already be invalid
                }
            }

            // Clear cookie
            res.clearCookie('sessionId', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                signed: true,
            });

            res.status(200).json({
                data: { message: 'Logged out successfully' },
                error: null,
                meta: { timestamp: new Date().toISOString() }
            });

        } catch (error) {
            console.error('Logout error:', error);
            // Still clear cookie even on error
            res.clearCookie('sessionId');
            res.status(200).json({
                data: { message: 'Logged out' },
                error: null,
                meta: { timestamp: new Date().toISOString() }
            });
        }
    });

    return router;
}
