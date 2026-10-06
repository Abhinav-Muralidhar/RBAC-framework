export type SmtpEncryption = 'none' | 'ssl' | 'tls';

export interface SmtpConfig {
  id: string;
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
  created_at: Date;
  created_by?: string | null;
  updated_at?: Date | null;
  updated_by?: string | null;
}
