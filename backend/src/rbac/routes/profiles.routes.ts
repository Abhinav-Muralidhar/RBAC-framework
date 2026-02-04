/**
 * Profiles Routes
 * 
 * REST API routes for profile management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profile.service';
import { ProfilesRepository } from '../repositories/profiles.repository';
import { ProfilePermissionsRepository } from '../repositories/profile_permissions.repository';
import { PermissionsRepository } from '../repositories/permissions.repository';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { ModuleRepository } from '../repositories/modules.repository';
import { RoleProfilesRepository } from '../repositories/role_profiles.repository';
import { UserRoleRepository } from '../repositories/user_roles.repository';
import { UsersRepository } from '../repositories/users.repository';
import { parseId, parsePagination } from './_paramUtils';
import { PermissionEffect } from '../models/profile_permissions.model';
import { IDatabase } from 'pg-promise';
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
    if (query.is_active) filter.is_active = query.is_active;
    if (query.code) filter.code = query.code;
    return filter;
}

export function createProfilesRouter(db: IDatabase<unknown>, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const profilesRepository = new ProfilesRepository(db);
    const profilePermissionsRepository = new ProfilePermissionsRepository(db);
    const permissionsRepository = new PermissionsRepository(db);
    const moduleRepository = new ModuleRepository(db);
    const roleProfilesRepository = new RoleProfilesRepository(db);
    const userRoleRepository = new UserRoleRepository(db);
    const usersRepository = new UsersRepository(db);

    // Initialize services
    const evaluationService = new EvaluationService(
        permissionsRepository,
    );
    const profileService = new ProfileService(
        profilesRepository,
        profilePermissionsRepository,
        permissionsRepository,
        evaluationService,
        auditService
    );

    /**
     * GET /rbac/profiles
     * List all profiles (paginated)
     */
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const pagination = parsePagination(req.query);
            const filter = parseFilter(req.query);
            const result = await profileService.listPaginated(actingUserId, filter, pagination);
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
     * GET /rbac/profiles/:id
     * Get profile by ID with full details (JOINed data)
     */
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profileId = parseId(req.params.id, 'profileId');
            const profile = await profileService.getById(req.user!.id, profileId);
            if (!profile) {
                return sendError(res, 404, `Profile not found: ${profileId}`, 'PROFILE_NOT_FOUND');
            }
            sendSuccess(res, profile);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/profiles
     * Create new profile
     */
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profile = await profileService.create(actingUserId, req.body);
            sendSuccess(res, profile);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/profiles/:id
     * Update profile
     */
    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profileId = parseId(req.params.id, 'profileId');
            const profile = await profileService.update(actingUserId, profileId, req.body);
            sendSuccess(res, profile);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/profiles/:id
     * Delete profile (soft delete)
     */
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profileId = parseId(req.params.id, 'profileId');
            await profileService.delete(actingUserId, profileId);
            sendSuccess(res, { deleted: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
