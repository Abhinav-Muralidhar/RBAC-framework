/**
 * Users Routes
 * 
 * REST API routes for user management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
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

export function createUsersRouter(pool: Pool, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const usersRepository = new UsersRepository(pool);
    const permissionsRepository = new PermissionsRepository(pool);
    const moduleRepository = new ModuleRepository(pool);
    const userRoleRepository = new UserRoleRepository(pool);
    const roleProfilesRepository = new RoleProfilesRepository(pool);
    const profilePermissionsRepository = new ProfilePermissionsRepository(pool);

    // Initialize services
    const evaluationService = new EvaluationService(
        moduleRepository,
        userRoleRepository,
        roleProfilesRepository,
        profilePermissionsRepository,
        permissionsRepository,
        usersRepository
    );
    const userService = new UserService(usersRepository, evaluationService, auditService);

    /**
     * GET /rbac/users
     * List all users (paginated)
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);

            const result = await userService.listPaginated(actingUserId, {}, pagination);
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
            const userId = parseId(req.params.id, 'userId');

            const user = await usersRepository.findByIdWithDetails(userId);
            if (!user) {
                return sendError(res, 404, `User not found: ${userId}`, 'USER_NOT_FOUND');
            }
            sendSuccess(res, user);
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
            const actingUserId = req.user!.id;
            const user = await userService.create(actingUserId, req.body);
            sendSuccess(res, user);
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
            const actingUserId = req.user!.id;
            const userId = parseId(req.params.id, 'userId');
            const user = await userService.update(actingUserId, userId, req.body);
            sendSuccess(res, user);
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
            const actingUserId = req.user!.id;
            const userId = parseId(req.params.id, 'userId');
            await userService.delete(actingUserId, userId);
            sendSuccess(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
