/**
 * Sessions Routes
 * 
 * REST API routes for session management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthSessionService } from '../services/authSession.service';
import { IAuditService } from '../services/audit.service';
import { getRequiredQuery, parseId } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';
import { parsePagination } from './_paramUtils';
/**
 * Standard response envelope
 */
function sendSuccess<T>(res: Response, data: T, meta?: Record<string, unknown>) {
    res.json({ data, error: null, meta: meta ?? {} });
}

export function createSessionsRouter(db: IDatabase<unknown>, auditService: IAuditService, evaluationService: EvaluationService, authSessionService: AuthSessionService): Router {
    const router = Router();

    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            await withTransaction(async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);
                const sessions = await authSessionService.findAll(t, pagination);
                sendSuccess(res, sessions.data, {
                    page: sessions.pagination.page,
                    limit: sessions.pagination.limit,
                    total: sessions.pagination.total,
                    totalPages: sessions.pagination.totalPages
                });
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
            await withTransaction(async (t: TransactionTask) => {
                const sessionId = req.user?.sessionId;
                if (!sessionId) {
                    throw new Error('Session ID not found');
                }
                const session = await authSessionService.resolveSession(t, sessionId);

                sendSuccess(res, {
                    id: session.id,
                    user_id: session.user_id,
                    login_at: session.login_at,
                    expires_at: session.expires_at,
                    ip_address: session.ip_address,
                    user_agent: session.user_agent
                });
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
            const sessions = await authSessionService.listActiveByUser(this, userId);

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
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const sessionId = parseId(req.params.sessionId, 'sessionId');
                await authSessionService.revoke(t, actingUserId, sessionId);
                sendSuccess(res, { revoked: true });
            });
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
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const targetUserId = getRequiredQuery(req.params, 'userId');
                const count = await authSessionService.revokeAllByUser(t, actingUserId, targetUserId);
                sendSuccess(res, { revoked: true });
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
