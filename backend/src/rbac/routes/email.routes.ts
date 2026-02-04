import { Router, Request, Response } from 'express';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { AuthSessionService } from '../services/authSession.service';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { EmailService } from '../services/email.service';

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

export function createEmailRouter(authSessionService: AuthSessionService): Router {
    const router = Router();
    const requireAuth = createAuthenticateMiddleware(authSessionService);

    /**
     * POST /email/test
     *
     * Tests SMTP connection using config sent from frontend.
     * No email is sent. No data is persisted.
     */
    router.post('/test', requireAuth, async (req: Request, res: Response) => {
        try {
            const smtpConfig = req.body as SmtpConfigCreate;

            const emailService = new EmailService(smtpConfig);
            await emailService.verifyConnection();

            sendSuccess(res, {
                success: true,
                message: 'SMTP connection successful'
            });
        } catch (error) {
            sendError(
                res,
                400,
                'SMTP connection failed',
                'SMTP_CONNECTION_FAILED'
            );
        }
    });

    return router;
}
