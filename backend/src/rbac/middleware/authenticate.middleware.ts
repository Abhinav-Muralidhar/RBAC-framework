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

// Uses global Request type augmentation from types/express.d.ts
// which adds user?: { id: string; sessionId?: string; }

export function createAuthenticateMiddleware(authSessionService: IAuthSessionService) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // 1. Read Cookie
            const sessionId = req.cookies['sessionId'];

            if (!sessionId) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            const session = await authSessionService.resolveSession(sessionId);

            // 3. Populate Context
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
