/**
 * Sharing Rules Routes
 *
 * REST API routes for sharing rule management.
 * All routes require authentication.
 * All mutating routes require RBAC enforcement.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';

import { SharingRuleService } from '../services/sharingRule.service';
import { SharingRulesRepository } from '../repositories/sharing_rules.repository';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { AuditLogsRepository } from '../repositories/audit_logs.repository';

import { requirePermission } from '../middleware/requirePermission.middleware';
import { parseId, parsePagination } from './_paramUtils';
import { ModuleRepository } from '../repositories/modules.repository';

/* -------------------------------------------------------------------------- */
/* Response helpers                                                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

function parseFilter(query: any): { is_active?: boolean } {
    const filter: { is_active?: boolean } = {};
    if (query.is_active !== undefined) {
        filter.is_active = query.is_active === 'true';
    }
    return filter;
}

/* -------------------------------------------------------------------------- */
/* Router Factory                                                              */
/* -------------------------------------------------------------------------- */

export function createSharingRulesRouter(db: IDatabase<unknown>): Router {
    const router = Router();

    /* --------------------------- repositories -------------------------------- */
    const sharingRulesRepository = new SharingRulesRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const auditRepository = new AuditLogsRepository(db);
    const moduleRepository = new ModuleRepository(db);

    /* ----------------------------- services ---------------------------------- */
    const evaluationService = new EvaluationService(permissionsRepository);
    const auditService = new AuditService(auditRepository, evaluationService, moduleRepository);

    const sharingRuleService = new SharingRuleService(
        sharingRulesRepository,
        evaluationService,
        auditService
    );

    /* -------------------------------------------------------------------------- */
    /* GET /rbac/sharing-rules                                                     */
    /* -------------------------------------------------------------------------- */
    router.get(
        '/',
        requirePermission('SETTINGS', 'read', evaluationService, auditService),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filters = parseFilter(req.query);

                const result = await sharingRuleService.listAll(
                    actingUserId,
                    filters,
                    pagination
                );

                sendSuccess(res, result.data, {
                    page: result.pagination.page,
                    limit: result.pagination.limit,
                    total: result.pagination.total,
                    totalPages: result.pagination.totalPages
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /* -------------------------------------------------------------------------- */
    /* GET /rbac/sharing-rules/:id                                                 */
    /* -------------------------------------------------------------------------- */
    router.get(
        '/:id',
        requirePermission('SETTINGS', 'read', evaluationService, auditService),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const ruleId = parseId(req.params.id, 'sharingRuleId');
                const rule = await sharingRuleService.getById(req.user!.id, ruleId);
                sendSuccess(res, rule);
            } catch (error) {
                next(error);
            }
        }
    );


    /* -------------------------------------------------------------------------- */
    /* PATCH /rbac/sharing-rules/:id                                               */
    /* -------------------------------------------------------------------------- */
    router.patch(
        '/:id',
        requirePermission('SETTINGS', 'update', evaluationService, auditService),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const actingUserId = req.user!.id;
                const ruleId = parseId(req.params.id, 'sharingRuleId');

                const updated = await sharingRuleService.update(
                    actingUserId,
                    ruleId,
                    req.body
                );

                sendSuccess(res, updated);
            } catch (error) {
                next(error);
            }
        }
    );

    /* -------------------------------------------------------------------------- */
    /* DELETE /rbac/sharing-rules/:id                                              */
    /* -------------------------------------------------------------------------- */
    router.delete(
        '/:id',
        requirePermission('SETTINGS', 'delete', evaluationService, auditService),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const actingUserId = req.user!.id;
                const ruleId = parseId(req.params.id, 'sharingRuleId');

                await sharingRuleService.delete(actingUserId, ruleId);
                sendSuccess(res, { deleted: true });
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
}
