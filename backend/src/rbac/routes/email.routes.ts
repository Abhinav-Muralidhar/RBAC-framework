import { Router, Request, Response, NextFunction } from 'express';
import { IDatabase } from 'pg-promise';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { AuthSessionService } from '../services/authSession.service';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';
import { EmailService } from '../services/email.service';
import { SmtpConfigService } from '../services/smtpConfig.service';
import { UsersRepository } from '../repositories/users.repository';
import { withTransaction, TransactionTask } from '../../utils/transaction.utils';
import { requirePermission } from '../middleware/requirePermission.middleware';
import { EvaluationService } from '../services/evaluation.service';
import { AuditService } from '../services/audit.service';
import { badRequest } from '../errors/api.errors';
import {
    getBodyObject,
    getOptionalBodyString,
    getRequiredBodyBoolean,
    getRequiredBodyNumber,
    getRequiredBodyString,
} from './_paramUtils';
import { sendSuccess } from './_response';

const smtpConfigFields = [
    'name',
    'host',
    'port',
    'username',
    'password',
    'encryption',
    'from_email',
    'from_name',
    'reply_to_email',
    'is_active'
] as const;

function parseTestSmtpConfig(input: unknown): SmtpConfigCreate {
    const body = getBodyObject(input);
    const payload = Object.fromEntries(
        smtpConfigFields
            .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
            .map((field) => [field, body[field]])
    ) as Partial<SmtpConfigCreate>;

    return {
        name: getRequiredBodyString(payload, 'name'),
        host: getRequiredBodyString(payload, 'host'),
        port: getRequiredBodyNumber(payload, 'port'),
        username: getRequiredBodyString(payload, 'username'),
        password: getRequiredBodyString(payload, 'password'),
        encryption: getRequiredBodyString(payload, 'encryption') as SmtpConfigCreate['encryption'],
        from_email: getRequiredBodyString(payload, 'from_email'),
        from_name: getRequiredBodyString(payload, 'from_name'),
        reply_to_email: getOptionalBodyString(payload, 'reply_to_email') ?? null,
        is_active: getRequiredBodyBoolean(payload, 'is_active')
    };
}

function parseEmailAttachments(input: unknown): Array<{
    filename: string;
    content: string;
    contentType?: string;
    encoding: 'base64';
}> {
    const body = getBodyObject(input);
    const attachments = body.attachments;

    if (attachments === undefined) {
        return [];
    }

    if (!Array.isArray(attachments)) {
        throw new Error('attachments must be an array');
    }

    return attachments.map((attachment, index) => {
        const item = getBodyObject(attachment);
        const filename = getRequiredBodyString(item, 'filename');
        const content = getRequiredBodyString(item, 'content');
        const contentType = getOptionalBodyString(item, 'contentType');

        if (!content) {
            throw new Error(`attachments[${index}].content is required`);
        }

        return {
            filename,
            content,
            ...(contentType ? { contentType } : {}),
            encoding: 'base64' as const,
        };
    });
}

export function createEmailRouter(
    db: IDatabase<unknown>,
    authSessionService: AuthSessionService,
    smtpConfigService: SmtpConfigService,
    usersRepository: UsersRepository,
    evaluationService: EvaluationService,
    auditService: AuditService
): Router {
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
    router.post('/test', requireAuth, requirePermission('SETTINGS', 'update', evaluationService, auditService), async (req: Request, res: Response, next: NextFunction) => {
        try {
            let smtpConfig: SmtpConfigCreate;
            const configId = getOptionalBodyString(req.body, 'id');
            const body = getBodyObject(req.body);

            if (configId && !Object.prototype.hasOwnProperty.call(body, 'host')) {
                // Test an existing saved SMTP config by ID
                const config = await withTransaction(db, async (t: TransactionTask) => {
                    return smtpConfigService.getByIdWithSecrets(t, configId);
                });
                smtpConfig = config;
            } else if (Object.prototype.hasOwnProperty.call(body, 'host')) {
                // Test raw config from request body
                smtpConfig = parseTestSmtpConfig(body);
            } else {
                return next(badRequest('Request must include either an SMTP config "id" or full SMTP config fields (host, port, etc.)', 'INVALID_REQUEST'));
            }

            const emailService = new EmailService(smtpConfig);
            await emailService.verifyConnection();

            sendSuccess(res, {
                success: true,
                message: 'SMTP connection successful'
            });
        } catch (error: any) {
            next(badRequest(error.message || 'SMTP connection failed', 'SMTP_CONNECTION_FAILED'));
        }
    });

    router.post('/send-report', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = getBodyObject(req.body);
            const subject = getRequiredBodyString(body, 'subject');
            const html = getRequiredBodyString(body, 'html');
            const text = getOptionalBodyString(body, 'text') ?? undefined;
            const to = getOptionalBodyString(body, 'to');
            const attachments = parseEmailAttachments(body);

            const [smtpConfig, user] = await withTransaction(db, async (t: TransactionTask) => {
                const activeSmtp = await smtpConfigService.getActive(t);
                const currentUser = await usersRepository.findById(t, req.user!.id);
                return [activeSmtp, currentUser] as const;
            });

            if (!smtpConfig) {
                return next(badRequest('No active SMTP configuration found', 'SMTP_NOT_CONFIGURED'));
            }

            if (!user?.primary_email && !to) {
                return next(badRequest('Recipient email is missing', 'RECIPIENT_EMAIL_REQUIRED'));
            }

            const emailService = new EmailService(smtpConfig);
            await emailService.sendMail(
                {
                    to: to ?? user!.primary_email,
                    subject,
                    html,
                    text: text ?? html.replace(/<[^>]+>/g, ' '),
                    attachments,
                },
                {
                    from_email: smtpConfig.from_email,
                    from_name: smtpConfig.from_name,
                    reply_to_email: smtpConfig.reply_to_email ?? null,
                }
            );

            sendSuccess(res, { success: true, message: 'Report email sent' });
        } catch (error: any) {
            next(badRequest(error.message || 'Unable to send report email', 'REPORT_EMAIL_FAILED'));
        }
    });

    return router;
}
