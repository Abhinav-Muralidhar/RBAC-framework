/**
 * Profiles Routes
 * 
 * REST API routes for profile management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profile.service';
import { EvaluationService } from '../services/evaluation.service';
import { IAuditService } from '../services/audit.service';
import { getOptionalQuery, parseBooleanQuery, parseId, parsePagination, pickAllowedFields } from './_paramUtils';
import { IDatabase } from 'pg-promise';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
import { CreateProfileRequestDto, UpdateProfileRequestDto } from '../dto/profile.dto';
import { sendSuccess } from './_response';
function parseFilter(query: Request['query']): { is_active?: boolean; code?: string; search?: string } {
    const filter: { is_active?: boolean; code?: string; search?: string } = {};
    const isActive = parseBooleanQuery(query, 'is_active');
    const code = getOptionalQuery(query, 'code');
    const search = getOptionalQuery(query, 'search');
    if (isActive !== undefined) filter.is_active = isActive;
    if (code) filter.code = code;
    if (search) filter.search = search;
    return filter;
}


export function createProfilesRouter(db: IDatabase<unknown>, auditService: IAuditService, evaluationService: EvaluationService, profileService: ProfileService): Router {
    const router = Router();
    const createProfileFields = ['name', 'code', 'description', 'is_active', 'permission_ids'] as const;
    const updateProfileFields = ['version', 'name', 'code', 'description', 'is_active', 'permission_ids'] as const;

    /**
     * GET /rbac/profiles
     * List all profiles (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const pagination = parsePagination(req.query);
                const filter = parseFilter(req.query);
                const result = await profileService.listPaginated(t, actingUserId, filter, pagination);
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
     * GET /rbac/profiles/:id
     * Get profile by ID with full details (JOINed data)
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const profileId = parseId(req.params.id, 'profileId');
                const profile = await profileService.getById(t, req.user!.id, profileId);
                if (!profile) {
                    const err = new Error('Profile not found');
                    (err as any).status = 404;
                    throw err;
                }
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/profiles
     * Create new profile
     */
    router.post('/', requirePermission('SETTINGS', 'create', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const payload = pickAllowedFields<CreateProfileRequestDto, keyof CreateProfileRequestDto>(req.body, createProfileFields);
                const profile = await profileService.create(t, actingUserId, payload as CreateProfileRequestDto, req.auditContext);
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * PATCH /rbac/profiles/:id
     * Update profile
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const profileId = parseId(req.params.id, 'profileId');
                const payload = pickAllowedFields<UpdateProfileRequestDto, keyof UpdateProfileRequestDto>(req.body, updateProfileFields);
                const profile = await profileService.update(t, actingUserId, profileId, payload as UpdateProfileRequestDto, req.auditContext);
                return profile;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * DELETE /rbac/profiles/:id
     * Delete profile (soft delete)
     */
    router.delete('/:id', requirePermission('SETTINGS', 'delete', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {

                const actingUserId = req.user!.id;
                const profileId = parseId(req.params.id, 'profileId');
                await profileService.delete(t, actingUserId, profileId, req.auditContext);
                return { message: 'Profile deleted successfully' };
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
