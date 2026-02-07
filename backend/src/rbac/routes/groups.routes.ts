/**
 * Groups Routes
 * 
 * REST API routes for group management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UnifiedGroupService } from '../services/group.service';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService, IAuditService } from '../services/audit.service';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';

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
function parseFilter(query: any): any {
    const filter: any = {};
    if (query.name) filter.name = query.name;
    if (query.is_active) filter.is_active = query.is_active;
    if (query.code) filter.code = query.code;
    return filter;
}

export function createGroupsRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, groupService: UnifiedGroupService): Router {
    const router = Router();

    /**
     * GET /rbac/groups
     * List all groups (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filter = parseFilter(req.query);

                const result = await groupService.listAll(t, actingUserId, filter, pagination);
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
    });

    /**
     * GET /rbac/groups/:id
     * Get group by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const groupId = parseId(req.params.id, 'groupId');
                const group = await groupService.getById(t, req.user!.id, groupId);
                if (!group) {
                    const error = new Error(`Group not found: ${groupId}`);
                    (error as any).code = 'GROUP_NOT_FOUND';
                    (error as any).status = 404;
                    throw error;
                }
                return group;
            });
            sendSuccess(res, result);
        } catch (error) {
            if (error.code === 'GROUP_NOT_FOUND') {
                return sendError(res, 404, error.message, 'GROUP_NOT_FOUND');
            }
            next(error);
        }
    });

    /**
     * POST /rbac/groups
     * Create new group
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const group = await groupService.create(t, actingUserId, req.body);
                return group;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/groups/:id
     * Update group
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const groupId = parseId(req.params.id, 'groupId');
                const group = await groupService.update(t, actingUserId, groupId, req.body);
                return group;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/groups/:id
     * Delete group (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const groupId = parseId(req.params.id, 'groupId');
                await groupService.delete(t, actingUserId, groupId);
                return { message: 'Group deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    return router;
}
