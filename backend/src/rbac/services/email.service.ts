import nodemailer, { Transporter } from 'nodemailer';
import { SmtpConfigCreate } from '../dto/smtp_config.dto';
import { SmtpConfig } from '../models/smtp_config.model';
import { RBACInternalError } from '../errors/rbac.errors';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
}

export class EmailService {
    private transporter: Transporter;

    constructor(config: SmtpConfig | SmtpConfigCreate) {
        this.transporter = this.createTransporter(config);
    }

    private createTransporter(
        config: SmtpConfig | SmtpConfigCreate
    ): Transporter {
        try {
            return nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.encryption === 'ssl',
                auth: {
                    user: config.username,
                    pass: config.password
                }
            });
        } catch {
            throw new RBACInternalError('Failed to create SMTP transporter');
        }
    }

    /**
     * Verify SMTP connectivity (no email sent)
     */
    async verifyConnection(): Promise<void> {
        try {
            await this.transporter.verify();
        } catch {
            throw new RBACInternalError('SMTP connection verification failed');
        }
    }

    /**
     * Send an email
     */
    async sendMail(
        options: SendEmailOptions,
        configMeta?: Pick<
            SmtpConfig,
            'from_email' | 'from_name' | 'reply_to_email'
        >
    ): Promise<void> {
        if (!options.text && !options.html) {
            throw new RBACInternalError('Email must contain text or html');
        }
        await this.transporter.sendMail({
            from: configMeta
                ? `"${configMeta.from_name}" <${configMeta.from_email}>`
                : `"App" <no-reply@app.com>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: configMeta?.reply_to_email ?? "no-reply@app.com"
        });
    }
}
