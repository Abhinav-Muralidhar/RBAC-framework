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
            const result = await withTransaction(async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);
                const sessions = await authSessionService.findAll(t, pagination);
                return sessions;
            });
            sendSuccess(res, result.data, {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages
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
            const result = await withTransaction(async (t: TransactionTask) => {
                const sessionId = req.user?.sessionId;
                if (!sessionId) {
                    const err = new Error('Session ID not found');
                    (err as any).status = 404;
                    throw err;
                }
                const session = await authSessionService.resolveSession(t, sessionId);
                const s = {
                    id: session.id,
                    user_id: session.user_id,
                    login_at: session.login_at,
                    expires_at: session.expires_at,
                    ip_address: session.ip_address,
                    user_agent: session.user_agent
                }
                return s;
            });
            sendSuccess(res, result);
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
            const result = await withTransaction(async (t: TransactionTask) => {
                const userId = parseId(req.params.userId, 'userId');
                const sessions = await authSessionService.listActiveByUser(t, userId);
                return sessions;
            });
            sendSuccess(res, result.data, {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                totalPages: result.pagination.totalPages
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
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const sessionId = parseId(req.params.sessionId, 'sessionId');
                await authSessionService.revoke(t, sessionId, actingUserId);
                return { message: 'Session revoked successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/sessions/user/:userId/all
     * Revoke all sessions for a user (admin only)
     */
    router.delete('/user/:userId/all', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const targetUserId = getRequiredQuery(req.params, 'userId');
                const count = await authSessionService.revokeAllByUser(t, targetUserId, actingUserId);
                return { message: 'All sessions revoked successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
