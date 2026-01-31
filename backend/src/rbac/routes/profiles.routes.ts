/**
 * Profiles Routes
 * 
 * REST API routes for profile management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
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

export function createProfilesRouter(pool: Pool, auditService: IAuditService): Router {
    const router = Router();

    // Initialize repositories
    const profilesRepository = new ProfilesRepository(pool);
    const profilePermissionsRepository = new ProfilePermissionsRepository(pool);
    const permissionsRepository = new PermissionsRepository(pool);
    const moduleRepository = new ModuleRepository(pool);
    const roleProfilesRepository = new RoleProfilesRepository(pool);
    const userRoleRepository = new UserRoleRepository(pool);
    const usersRepository = new UsersRepository(pool);

    // Initialize services
    const evaluationService = new EvaluationService(
        moduleRepository,
        userRoleRepository,
        roleProfilesRepository,
        profilePermissionsRepository,
        permissionsRepository,
        usersRepository
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

            const result = await profileService.listPaginated(actingUserId, {}, pagination);
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
            const profile = await profilesRepository.findByIdWithDetails(profileId);
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

    /**
     * PUT /rbac/profiles/:id/permissions
     * Update profile permissions
     */
    router.put('/:id/permissions', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profileId = parseId(req.params.id, 'profileId');
            const { permission_ids } = req.body;
            await profileService.updateProfilePermissions(actingUserId, profileId, permission_ids ?? []);
            sendSuccess(res, { updated: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/profiles/:id/permissions/:permissionId
     * Assign permission to profile
     */
    router.post('/:id/permissions/:permissionId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profileId = parseId(req.params.id, 'profileId');
            const permissionId = parseId(req.params.permissionId, 'permissionId');
            const effect: PermissionEffect = req.body.effect ?? 'allow';
            await profileService.assignPermission(actingUserId, profileId, permissionId, effect);
            sendSuccess(res, { assigned: true });
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/profiles/:id/permissions/:permissionId
     * Revoke permission from profile
     */
    router.delete('/:id/permissions/:permissionId', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actingUserId = req.user!.id;
            const profileId = parseId(req.params.id, 'profileId');
            const permissionId = parseId(req.params.permissionId, 'permissionId');
            await profileService.revokePermission(actingUserId, profileId, permissionId);
            sendSuccess(res, { revoked: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
