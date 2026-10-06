/**
 * Organizations Routes
 *
 * REST API routes for organization management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';

import { getOptionalQuery, parseBooleanQuery, parseId, parsePagination, pickAllowedFields } from './_paramUtils';
import { OrganizationService } from '../services/organization.service';
import { AuditService } from '../services/audit.service';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import {
    UpdateOrganizationRequestDto
} from '../dto';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
import { createUpload } from '../middleware/upload.middleware';
import { buildStoredUploadPath } from '../storage/file-storage';
import { deleteStoredUpload } from '../storage/file-storage';
import { OrganizationLogoCleanup, UploadedFileReference } from '../types/repository.types';
import { sendSuccess } from './_response';

// Configure logo upload: images only, 2MB max
const logoUpload = createUpload({
    dest: 'logos',
    allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxSizeMB: 4,
    fieldName: 'logo'
});

function normalizeFinancialYearField(payload: UpdateOrganizationRequestDto): void {
    const value = payload.financial_year_start_month;
    if (value === undefined || value === null) {
        return;
    }
    const trimmed = String(value).trim();
    if (trimmed === '') {
        payload.financial_year_start_month = null;
        return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
        throw new Error('Financial year start month must be a number');
    }
    payload.financial_year_start_month = parsed;
}

function parseOrganizationFilters(query: Request['query']): { is_active?: boolean; name?: string; code?: string } {
    const filter: { is_active?: boolean; name?: string; code?: string } = {};
    const isActive = parseBooleanQuery(query, 'is_active');
    const name = getOptionalQuery(query, 'name');
    const code = getOptionalQuery(query, 'code');
    if (isActive !== undefined) {
        filter.is_active = isActive;
    }
    if (name) {
        filter.name = `%${name}%`;
    }
    if (code) {
        filter.code = `%${code}%`;
    }
    return filter;
}

export function createOrganizationsRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, organizationService: OrganizationService): Router {
    const router = Router();
    const updateOrganizationFields = ['version', 'company_name', 'company_logo', 'address', 'gstin', 'city', 'state', 'postal_code', 'country', 'country_code', 'phone', 'fax', 'website', 'facebook', 'twitter', 'linkedin', 'financial_year_start_month', 'is_active'] as const;

    /**
     * GET /rbac/organizations
     * List organizations (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const pagination = parsePagination(req.query);
                const filters = parseOrganizationFilters(req.query);

                const result = await organizationService.getOrganizations(t,
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
    });

    /**
     * GET /rbac/organizations/active
     * Fetches the first/active organization configuration.
     */
    router.get('/active', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const orgs = await organizationService.getOrganizations(t, {}, { page: 1, limit: 1 });
                return orgs.data[0] || null;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * GET /rbac/organizations/:id
     * Get organization by ID
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const id = parseId(req.params.id, 'id');
                const organization = await organizationService.getOrganization(t, id);
                return organization;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    /**
     * POST /rbac/organizations
     * Create a new organization
     */
    //router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    //    try {
    //        const payload: CreateOrganizationRequestDto = req.body;
    //        const organization = await organizationService.createOrganization(
    //           payload,
    //           req.user!.id
    //       );
    //
    //       sendSuccess(res, organization);
    //   } catch (error) {
    //       next(error);
    //   }
    //  });

    /**
     * PUT /rbac/organizations/:id
     * Update organization
     */
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), logoUpload, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(db, async (t: TransactionTask) => {
                const id = parseId(req.params.id, 'id');
                const payload = pickAllowedFields<UpdateOrganizationRequestDto, keyof UpdateOrganizationRequestDto>(req.body, updateOrganizationFields) as UpdateOrganizationRequestDto;
                normalizeFinancialYearField(payload);
                const existingOrganization = await organizationService.getOrganization(t, id);

                // If a logo file was uploaded, compute relative path for DB storage
                const uploadedLogo: UploadedFileReference | undefined = req.file
                    ? {
                        storedPath: buildStoredUploadPath('logos', req.file.filename),
                        originalName: req.file.originalname,
                        mimeType: req.file.mimetype,
                        sizeBytes: req.file.size
                    }
                    : undefined;

                const organization = await organizationService.updateOrganization(t, id, payload, req.user!.id, req.auditContext, uploadedLogo);
                const cleanup: OrganizationLogoCleanup = {
                    previousLogoPath: existingOrganization.company_logo ?? null,
                    previousLogoFileId: existingOrganization.company_logo_file_id ?? null,
                    logoChanged: Boolean(uploadedLogo) && existingOrganization.company_logo_file_id !== organization.company_logo_file_id
                };

                return { organization, cleanup };
            });
            try {
                await organizationService.cleanupReplacedLogo(result.cleanup);
            } catch (cleanupError) {
                console.error('Organization logo cleanup failed:', cleanupError);
            }
            sendSuccess(res, result.organization);
        } catch (error) {
            if (req.file?.path) {
                await deleteStoredUpload(req.file.path);
            }
            next(error);
        }
    });

    return router;
}
