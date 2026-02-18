/**
 * Audit Logs Routes
 * 
 * REST API routes for audit log viewing.
 * All routes require authentication (applied at router level).
 * 
 * Note: Audit logs are read-only via API. They are created internally by services.
 * Filtering is not supported (all fields are encrypted at rest).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { parseId, parsePagination } from './_paramUtils';
import { AuditService } from '../services/audit.service';
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';

/**
 * Standard response envelope
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

export function createAuditLogsRouter(db: IDatabase<unknown>, auditLogService: AuditService, evaluationService: EvaluationService): Router {
    const router = Router();

    /**
     * GET /rbac/audit-logs
     * List all audit logs (paginated, decrypted)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);

                const logs = await auditLogService.getAll(
                    t,
                    req.user!.id,
                    pagination
                );

                return logs;
            });
            sendSuccess(res, result.data, result.pagination);

        } catch (error) {
            sendError(res, 500, 'Audit log retrieval failed', 'INTERNAL_ERROR');
        }
    });

    /**
     * GET /rbac/audit-logs/:id
     * Get audit log by ID (decrypted)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const logId = parseId(req.params.id, 'id');
                const log = await auditLogService.getById(t, req.user!.id, logId);
                return log;
            });
            sendSuccess(res, result);
        } catch (error) {
            sendError(res, 500, 'Audit log retrieval failed', 'INTERNAL_ERROR');
        }
    });

    return router;
}
