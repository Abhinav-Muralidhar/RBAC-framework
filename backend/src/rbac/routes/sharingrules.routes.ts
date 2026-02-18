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
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { parseId, parsePagination } from './_paramUtils';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';

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

export function createSharingRulesRouter(db: IDatabase<unknown>, auditService: AuditService, evaluationService: EvaluationService, sharingRuleService: SharingRuleService): Router {
    const router = Router();

    /* -------------------------------------------------------------------------- */
    /* GET /rbac/sharing-rules                                                     */
    /* -------------------------------------------------------------------------- */
    router.get(
        '/',
        requirePermission('SETTINGS', 'read', evaluationService, auditService),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await withTransaction(async (t: TransactionTask) => {
                    const actingUserId = req.user!.id;
                    const pagination = parsePagination(req.query);
                    const filters = parseFilter(req.query);

                    const result = await sharingRuleService.listAll(t,
                        actingUserId,
                        filters,
                        pagination
                    );

                    return result;
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
                const result = await withTransaction(async (t: TransactionTask) => {
                    const ruleId = parseId(req.params.id, 'sharingRuleId');
                    const rule = await sharingRuleService.getById(t, req.user!.id, ruleId);
                    return rule;
                });
                sendSuccess(res, result);
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
                const result = await withTransaction(async (t: TransactionTask) => {
                    const actingUserId = req.user!.id;
                    const ruleId = parseId(req.params.id, 'sharingRuleId');

                    const updated = await sharingRuleService.update(t,
                        actingUserId,
                        ruleId,
                        req.body,
                        req.auditContext
                    );
                    return updated;
                });
                sendSuccess(res, result);
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
                const result = await withTransaction(async (t: TransactionTask) => {
                    const actingUserId = req.user!.id;
                    const ruleId = parseId(req.params.id, 'sharingRuleId');
                    await sharingRuleService.delete(t, actingUserId, ruleId, req.auditContext);
                    return { message: 'Sharing rule deleted successfully' };
                });
                sendSuccess(res, result);
            } catch (error) {
                next(error);
            }
        }
    );

    return router;
}
