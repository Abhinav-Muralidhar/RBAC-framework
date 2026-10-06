export type SmtpEncryption = 'none' | 'ssl' | 'tls';

export interface SmtpConfigCreate {

    name: string;

    host: string;
    port: number;

    username: string;
    password: string;

    encryption: SmtpEncryption;

    from_email: string;
    from_name: string;
    reply_to_email?: string | null;

    is_active: boolean;
    created_by?: string | null;
}

export interface SmtpConfigUpdate {
    version: number;
    name: string;

    host: string;
    port: number;

    username: string;
    password: string;

    encryption: SmtpEncryption;

    from_email: string;
    from_name: string;
    reply_to_email?: string | null;

    is_active: boolean;
}
