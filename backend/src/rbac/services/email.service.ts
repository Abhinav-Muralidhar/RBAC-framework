import nodemailer, { Transporter } from 'nodemailer';
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

    constructor(private smtpConfig: SmtpConfig) {
        this.transporter = this.createTransporter(smtpConfig);
    }

    private createTransporter(config: SmtpConfig): Transporter {
        try {
            return nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.encryption === 'ssl', // true for SSL (465)
                auth: {
                    user: config.username,
                    pass: config.password
                }
            });
        } catch (err) {
            throw new RBACInternalError('Failed to create SMTP transporter');
        }
    }

    async sendMail(options: SendEmailOptions): Promise<void> {
        await this.transporter.sendMail({
            from: `"${this.smtpConfig.from_name}" <${this.smtpConfig.from_email}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: this.smtpConfig.reply_to_email ?? undefined
        });

    }
}
