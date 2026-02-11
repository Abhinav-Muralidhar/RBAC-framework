/**
 * Organizations Routes
 *
 * REST API routes for organization management.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';

import { parseId, parsePagination } from './_paramUtils';
import { OrganizationService } from '../services/organization.service';
import { AuditService } from '../services/audit.service';
import { EvaluationService } from '../services/evaluation.service';
import { requirePermission } from '../middleware/requirePermission.middleware';
import {
    UpdateOrganizationRequestDto
} from '../dto';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';

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

function parseOrganizationFilters(query: any) {
    const filter: any = {};
    if (query.is_active) {
        filter.is_active = query.is_active === 'true';
    }
    if (query.name) {
        filter.name = `%${query.name}%`;
    }
    if (query.code) {
        filter.code = `%${query.code}%`;
    }
    return filter;
}

export function createOrganizationsRouter(db: IDatabase<unknown>, evaluationService: EvaluationService, auditService: AuditService, organizationService: OrganizationService): Router {
    const router = Router();

    /**
     * GET /rbac/organizations
     * List organizations (paginated)
     */
    router.get('/', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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
     * GET /rbac/organizations/:id
     * Get organization by ID
     */
    router.get('/:id', requirePermission('SETTINGS', 'read', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
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
    router.patch('/:id', requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await withTransaction(async (t: TransactionTask) => {
                const id = parseId(req.params.id, 'id');
                const payload: UpdateOrganizationRequestDto = req.body;

                const organization = await organizationService.updateOrganization(t, id, payload, req.auditContext);
                return organization;
            });
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
