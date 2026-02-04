/**
 * SMTP Configuration Types
 */

export type SmtpEncryption = 'none' | 'ssl' | 'tls';

export interface SmtpConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    encryption: SmtpEncryption;
    from_email: string;
    from_name: string;
    reply_to_email?: string | null;
    is_active: boolean;
}

export interface CreateSmtpConfigDto {
    name: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    encryption: SmtpEncryption;
    from_email: string;
    from_name?: string;
    reply_to_email?: string;
    is_active?: boolean;
}

export interface UpdateSmtpConfigDto {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    encryption?: SmtpEncryption;
    from_email?: string;
    from_name?: string;
    reply_to_email?: string;
    is_active?: boolean;
}
