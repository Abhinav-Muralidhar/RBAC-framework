/**
 * Users Routes
 * 
 * REST API routes for user management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';

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

function parseFilters(query: any): any {
    const filters: Record<string, unknown> = {};
    if (query.name) filters.name = query.name;
    if (query.email) filters.email = query.email;
    if (query.username) filters.username = query.username;
    if (query.status) filters.status = query.status;
    if (query.search) filters.search = query.search;
    return filters;
}

export function createUsersRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, userService: UserService): Router {
    const router = Router();

    /**
     * GET /rbac/users
     * List all users (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filters = parseFilters(req.query);

                const result = await userService.listPaginated(t, actingUserId, filters, pagination);
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
     * GET /rbac/users/:id
     * Get user by ID with full details (JOINed data)
     */
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const userId = parseId(req.params.id, 'userId');

                const user = await userService.getById(t, req.user!.id, userId);
                if (!user) {
                    const err = new Error('User not found');
                    (err as any).status = 404;
                    throw err;
                }
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/users
     * Create new user
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const user = await userService.create(t, actingUserId, req.body);
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/users/:id
     * Update user
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                const user = await userService.update(t, actingUserId, userId, req.body);
                return user;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/users/:id
     * Delete user (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                await userService.delete(t, actingUserId, userId);
                return { message: 'Deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });
    return router;
}
