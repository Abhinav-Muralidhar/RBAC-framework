/**
 * Authenticate Middleware
 * 
 * SINGLE SOURCE OF TRUTH for Request Context.
 * 
 * Responsibilities:
 * 1. Read 'sessionId' cookie (HTTP Only)
 * 2. Resolve Session via AuthSessionService (Global Lookup)
 * 3. Populate req.user = { id, sessionId }
 * 4. Fail Closed on any error
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthSessionService } from '../services/authSession.service';

// Session TTL for sliding expiration (24 hours)
const SESSION_EXTEND_MS = 24 * 60 * 60 * 1000;

/**
 * Creates the main authentication middleware.
 * Verifies session exists and populates req.user.
 */
export function createAuthenticateMiddleware(authSessionService: IAuthSessionService) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // 1. Read Signed Cookie (tamper-proof)
            // If cookie was tampered with, signedCookies[key] will be false
            const sessionToken = req.signedCookies['sessionToken'];

            if (!sessionToken || sessionToken === false) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            const session = await authSessionService.resolveSession(sessionToken);

            if (!session) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or expired session',
                    code: 'INVALID_SESSION'
                });
                return;
            }

            req.user = {
                id: session.user_id,
                sessionId: session.id
            };


            next();

        } catch (error) {
            // Fail Closed
            console.error('Authentication Failed:', error);

            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired session',
                code: 'INVALID_SESSION'
            });
        }
    };
}

/**
 * Creates middleware that validates session is still active and extends expiry.
 * 
 * This should be used AFTER createAuthenticateMiddleware.
 * On each valid request, extends the session expiry by 24 hours (sliding expiration).
 */
export function createRequireActiveSessionMiddleware(authSessionService: IAuthSessionService) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Must have user from authenticate middleware
            if (!req.user?.sessionId) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'No session context',
                    code: 'NO_SESSION'
                });
                return;
            }

            // Check if session is still active (not logged out, not expired)
            const isActive = await authSessionService.isValid(req.user.sessionId);
            if (!isActive) {
                res.status(401).json({
                    error: 'Session expired',
                    message: 'Your session has expired. Please log in again.',
                    code: 'SESSION_EXPIRED'
                });
                return;
            }

            // Extend session expiry by 24 hours (sliding expiration)
            const newExpiry = new Date(Date.now() + SESSION_EXTEND_MS);
            await authSessionService.update(req.user.sessionId, { expires_at: newExpiry });

            next();

        } catch (error) {
            console.error('Session validation failed:', error);
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Session validation failed',
                code: 'SESSION_CHECK_FAILED'
            });
        }
    };
}
