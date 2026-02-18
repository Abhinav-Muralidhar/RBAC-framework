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

    private createTransporter(config: SmtpConfig | SmtpConfigCreate): Transporter {
        try {
            const transportOptions: any = {
                host: config.host,
                port: config.port,
                auth: {
                    user: config.username,
                    pass: config.password,
                },
                // SSL if port 465 or user explicitly chose 'ssl'
                secure: config.encryption === 'ssl',
            };

            // TLS (STARTTLS) handling for port 587 or user chose 'tls'
            if (config.encryption === 'tls') {
                transportOptions.requireTLS = true;
                transportOptions.tls = { rejectUnauthorized: false }; // avoid self-signed issues
            }

            return nodemailer.createTransport(transportOptions);
        } catch (err: any) {
            console.error('Failed to create SMTP transporter:', err);
            throw new RBACInternalError('Failed to create SMTP transporter');
        }
    }

    /**
     * Verify SMTP connectivity (no email sent)
     */
    async verifyConnection(): Promise<void> {
        try {
            await this.transporter.verify();
        } catch (err: any) {
            console.error('SMTP verification failed:', err);
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

        try {
            await this.transporter.sendMail({
                from: configMeta
                    ? `"${configMeta.from_name}" <${configMeta.from_email}>`
                    : `"App" <no-reply@app.com>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                replyTo: configMeta?.reply_to_email ?? configMeta?.from_email ?? 'no-reply@app.com',
            });
        } catch (err: any) {
            console.error('Failed to send email:', err);
            throw new RBACInternalError('Failed to send email');
        }
    }
}