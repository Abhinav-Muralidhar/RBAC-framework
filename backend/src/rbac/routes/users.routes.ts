/**
 * Users Routes
 * 
 * REST API routes for user management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { UsersRepository } from '../repositories/users.repository';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { ModuleRepository } from '../repositories/modules.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { parseId, parsePagination } from './_paramUtils';
import { IDatabase } from 'pg-promise';
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

function parseFilters(query: any): any {
    const filters: Record<string, unknown> = {};
    if (query.name) filters.name = query.name;
    if (query.email) filters.email = query.email;
    if (query.username) filters.username = query.username;
    if (query.status) filters.status = query.status;
    return filters;
}

export function createUsersRouter(db: IDatabase<unknown>, userService: UserService): Router {
    const router = Router();

    /**
     * GET /rbac/users
     * List all users (paginated)
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filters = parseFilters(req.query);

                const result = await userService.listPaginated(t, actingUserId, filters, pagination);
                sendSuccess(res, result.data, {
                    page: result.pagination.page,
                    limit: result.pagination.limit,
                    total: result.pagination.total,
                    totalPages: result.pagination.totalPages
                });
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
            await withTransaction(async (t: TransactionTask) => {
                const userId = parseId(req.params.id, 'userId');

                const user = await userService.getById(t, req.user!.id, userId);
                if (!user) {
                    return sendError(res, 404, `User not found: ${userId}`, 'USER_NOT_FOUND');
                }
                sendSuccess(res, user);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/users
     * Create new user
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const user = await userService.create(t, actingUserId, req.body);
                sendSuccess(res, user);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/users/:id
     * Update user
     */
    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                const user = await userService.update(t, actingUserId, userId, req.body);
                sendSuccess(res, user);
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/users/:id
     * Delete user (soft delete)
     */
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            await withTransaction(async (t: TransactionTask) => {
                const actingUserId = req.user!.id;
                const userId = parseId(req.params.id, 'userId');
                await userService.delete(t, actingUserId, userId);
                sendSuccess(res, { deleted: true });
            });
        } catch (error) {
            next(error);
        }
    });
    return router;
}
