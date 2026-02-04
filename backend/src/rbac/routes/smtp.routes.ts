/**
 * SMTP Config Routes
 * 
 * REST API routes for managing SMTP configurations.
 * All routes require authentication (applied at router level).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { SmtpConfigRepository } from '../repositories/smtp_config.repository';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { AuditService } from '../services/audit.service';
import { parsePagination, getRequiredParam } from './_paramUtils';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';

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

/**
 * Parse filters from query parameters
 */
function parseFilters(query: any): { isActive?: boolean } {
    if (query.is_active === 'true') return { isActive: true };
    if (query.is_active === 'false') return { isActive: false };
    return {};
}

export function createSmtpConfigRouter(db: IDatabase<unknown>, auditService: AuditService): Router {
    const router = Router();

    const smtpRepo = new SmtpConfigRepository(db);
    const smtpService = new SmtpConfigService(smtpRepo, auditService);

    // --- List all SMTP configs ---
    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters = parseFilters(req.query);
            const pagination = parsePagination(req.query);
            const result = await smtpService.listAll(filters, pagination);
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

    // --- Get SMTP config by ID ---
    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = getRequiredParam(req.params, 'id');
            const config = await smtpService.getById(id);
            sendSuccess(res, config);
        } catch (error) {
            next(error);
        }
    });

    // --- Create a new SMTP config ---
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = req.body as SmtpConfigCreate;
            const actingUserId = req.user!.id;
            const config = await smtpService.create(data, actingUserId);
            sendSuccess(res, config);
        } catch (error) {
            next(error);
        }
    });

    // --- Update an existing SMTP config ---
    router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = getRequiredParam(req.params, 'id');
            const data = req.body;
            const actingUserId = req.user!.id;
            const updated = await smtpService.update(id, data, actingUserId);
            sendSuccess(res, updated);
        } catch (error) {
            next(error);
        }
    });

    // Delete an SMTP config
    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = getRequiredParam(req.params, 'id');
            const actingUserId = req.user!.id;
            await smtpService.update(id, { is_active: false }, actingUserId);
            sendSuccess(res, { message: 'Deleted successfully' });
        } catch (error) {
            next(error);
        }
    });

    return router;
}
