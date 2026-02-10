import { Router, Request, Response } from 'express';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { AuthSessionService } from '../services/authSession.service';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { EmailService } from '../services/email.service';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { withTransaction, TransactionTask } from '../utils/transaction.utils';

/**
 * Standard response helpers
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

export function createEmailRouter(authSessionService: AuthSessionService, smtpConfigService: SmtpConfigService): Router {
    const router = Router();
    const requireAuth = createAuthenticateMiddleware(authSessionService);

    /**
     * POST /email/test
     *
     * Tests SMTP connection.
     * Accepts either:
     *   - { id: string }              → fetches saved config from DB and tests it
     *   - { host, port, ... }         → tests raw config from request body
     */
    router.post('/test', requireAuth, async (req: Request, res: Response) => {
        try {
            let smtpConfig: SmtpConfigCreate;

            if (req.body?.id && !req.body?.host) {
                // Test an existing saved SMTP config by ID
                const config = await withTransaction(async (t: TransactionTask) => {
                    return smtpConfigService.getById(t, req.body.id);
                });
                smtpConfig = config;
            } else if (req.body?.host) {
                // Test raw config from request body
                smtpConfig = req.body as SmtpConfigCreate;
            } else {
                return sendError(res, 400, 'Request must include either an SMTP config "id" or full SMTP config fields (host, port, etc.)', 'INVALID_REQUEST');
            }

            const emailService = new EmailService(smtpConfig);
            await emailService.verifyConnection();

            sendSuccess(res, {
                success: true,
                message: 'SMTP connection successful'
            });
        } catch (error: any) {
            console.error('SMTP test failed:', error);
            sendError(
                res,
                400,
                error.message || 'SMTP connection failed',
                'SMTP_CONNECTION_FAILED'
            );
        }
    });

    return router;
}