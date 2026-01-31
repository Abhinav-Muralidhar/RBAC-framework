/**
 * Audit Logs Routes
 * 
 * REST API routes for audit log viewing.
 * All routes require authentication (applied at router level).
 * 
 * Note: Audit logs are read-only via API. They are created internally by services.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { parseId, parsePagination, getRequiredParam } from './_paramUtils';

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

export function createAuditLogsRouter(pool: Pool): Router {
    const router = Router();

    // Initialize repository
    const auditLogsRepository = new AuditLogsRepository(pool);

    /**
     * GET /rbac/audit-logs
     * List all audit logs with JOINed data (paginated)
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const pagination = parsePagination(req.query);
            const offset = (pagination.page - 1) * pagination.limit;
            const logs = await auditLogsRepository.findAllWithDetails(pagination.limit, offset);

            sendSuccess(res, logs, {
                page: pagination.page,
                limit: pagination.limit
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/audit-logs/:id
     * Get audit log by ID with JOINed data
     */
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const logId = parseId(req.params.id, 'logId');
            const log = await auditLogsRepository.findByIdWithDetails(logId);
            if (!log) {
                return sendError(res, 404, `Audit log not found: ${logId}`, 'AUDIT_LOG_NOT_FOUND');
            }
            sendSuccess(res, log);
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/audit-logs/user/:userId
     * Get audit logs for a specific user
     */
    router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = parseId(req.params.userId, 'userId');
            const pagination = parsePagination(req.query);
            const offset = (pagination.page - 1) * pagination.limit;
            const logs = await auditLogsRepository.findByUser(userId, pagination.limit, offset);

            sendSuccess(res, logs, {
                page: pagination.page,
                limit: pagination.limit
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/audit-logs/entity/:entityType/:entityId
     * Get audit logs for a specific entity
     */
    router.get('/entity/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const entityType = getRequiredParam(req.params, 'entityType');
            const entityId = getRequiredParam(req.params, 'entityId');
            const pagination = parsePagination(req.query);
            const offset = (pagination.page - 1) * pagination.limit;
            const logs = await auditLogsRepository.findByEntity(entityType, entityId, pagination.limit, offset);

            sendSuccess(res, logs, {
                page: pagination.page,
                limit: pagination.limit
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
