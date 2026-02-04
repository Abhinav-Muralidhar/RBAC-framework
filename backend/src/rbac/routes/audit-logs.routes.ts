/**
 * Audit Logs Routes
 * 
 * REST API routes for audit log viewing.
 * All routes require authentication (applied at router level).
 * 
 * Note: Audit logs are read-only via API. They are created internally by services.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { parseId, parsePagination, getRequiredParam } from './_paramUtils';
import { AuditService } from '../services/audit.service';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';
import { IDatabase } from 'pg-promise';
import { EvaluationService } from '../services/evaluation.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { AuditLogListFilterDto } from '../dto/audit_log.dto';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { ModuleRepository } from '../repositories/modules.repository';

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

export function parseAuditLogFilters(query: any): AuditLogListFilterDto {
    return {
        user_id: query.user_id,
        action: query.action,
        entity_type: query.entity_type,
        entity_id: query.entity_id,
        status: query.status,
        start_date: query.start_date,
        end_date: query.end_date
    };
}


export function createAuditLogsRouter(db: IDatabase<unknown>): Router {
    const router = Router();


    const evaluationService = new EvaluationService(
        new PermissionsRepository(db)
    );

    // --- Audit service ---
    const auditLogService = new AuditService(
        new AuditLogsRepository(db),
        evaluationService,
        new ModuleRepository(db),
    );


    /**
     * GET /rbac/audit-logs
     * List all audit logs with JOINed data (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {

            const pagination = parsePagination(req.query);
            const logs = await auditLogService.getAll(req.user!.id, parseAuditLogFilters(req.query), pagination);

            sendSuccess(res, logs, {
                page: logs.pagination.page,
                limit: logs.pagination.limit,
                total: logs.pagination.total,
                totalPages: logs.pagination.totalPages
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/audit-logs/:id
     * Get audit log by ID with JOINed data
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditLogService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const logId = parseId(req.params.id, 'id');
            const log = await auditLogService.getById(req.user!.id, logId);
            sendSuccess(res, log);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
