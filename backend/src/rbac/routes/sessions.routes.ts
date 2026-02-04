/**
 * Sessions Routes
 * 
 * REST API routes for session management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AuthSessionService } from '../services/authSession.service';
import { AuthSessionsRepository } from '../repositories/auth_sessions.repository';
import { IAuditService } from '../services/audit.service';
import { getRequiredQuery, parseId } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { requirePermission } from '../middleware/requirePermission.middleware';

/**
 * Standard response envelope
 */
function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>) {
    res.json({ data, error: null, meta: meta ?? {} });
}

export function createSessionsRouter(db: IDatabase<unknown>, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repository and service
    const authSessionsRepository = new AuthSessionsRepository(db);
    // Initialize services
    const permissionsRepository = new PermissionsRepository(db);
    const evaluationService = new EvaluationService(
        permissionsRepository
    );
    const authSessionService = new AuthSessionService(authSessionsRepository, auditService, evaluationService);

    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sessions = await authSessionService.findAll();
            sendSuccess(res, sessions.data, {
                page: sessions.pagination.page,
                limit: sessions.pagination.limit,
                total: sessions.pagination.total,
                totalPages: sessions.pagination.totalPages
            });
        } catch (error) {
            next(error);
        }
    });






    /**
     * GET /rbac/sessions/current
     * Get current user's active session info
     */
    router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sessionId = req.user?.sessionId;
            if (!sessionId) {
                throw new Error('Session ID not found');
            }
            const session = await authSessionService.resolveSession(sessionId);

            sendSuccess(res, {
                id: session.id,
                user_id: session.user_id,
                login_at: session.login_at,
                expires_at: session.expires_at,
                ip_address: session.ip_address,
                user_agent: session.user_agent
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/sessions/user/:userId
     * Get all active sessions for a user (admin only)
     */
    router.get('/user/:userId', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = parseId(req.params.userId, 'userId');
            const sessions = await authSessionService.listActiveByUser(userId);

            sendSuccess(res, sessions.data, {
                page: sessions.pagination.page,
                limit: sessions.pagination.limit,
                total: sessions.pagination.total,
                totalPages: sessions.pagination.totalPages
            });
        } catch (error) {
            next(error);
        }
    });


    /**
     * DELETE /rbac/sessions/:sessionId
     * Revoke a specific session (admin only)
     */
    router.delete('/:sessionId', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const sessionId = parseId(req.params.sessionId, 'sessionId');
            await authSessionService.revoke(actingUserId, sessionId);
            sendSuccess(res, { revoked: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/sessions/user/:userId/all
     * Revoke all sessions for a user (admin only)
     */
    router.delete('/user/:userId/all', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const targetUserId = getRequiredQuery(req.params, 'userId');
            const count = await authSessionService.revokeAllByUser(actingUserId, targetUserId);
            sendSuccess(res, { revoked: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
