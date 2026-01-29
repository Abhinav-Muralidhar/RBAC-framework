/**
 * SmtpConfigService
 * 
 * Service layer for SMTP configuration management.
 * OWNS: SMTP config lifecycle, credential encryption/decryption
 * MUST NOT: Send emails, evaluate permissions, manage users
 */

import { SmtpConfig, SmtpEncryption } from '../models/smtp_config.model';
import { ISmtpConfigRepository } from '../repositories/smtp_config.repository';
import { RBACInternalError } from '../errors/rbac.errors';

export interface ISmtpConfigService {
    /**
     * Get SMTP config by ID
     * @throws SmtpConfigNotFoundError
     */
    getById(configId: string): Promise<SmtpConfig>;

    /**
     * List all SMTP configs in organization
     */
    listAll(): Promise<SmtpConfig[]>;

    /**
     * Get active SMTP config for organization
     * @throws SmtpConfigNotFoundError if no active config
     */
    getActive(): Promise<SmtpConfig>;

    /**
     * Create new SMTP config
     * @throws SmtpConfigCreationError
     */
    create(

        data: {
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
        },
        actingUserId: string
    ): Promise<SmtpConfig>;

    /**
     * Update SMTP config
     * @throws SmtpConfigNotFoundError
     */
    update(

        configId: string,
        data: Partial<SmtpConfig>,
        actingUserId: string
    ): Promise<SmtpConfig>;

    /**
     * Delete SMTP config
     * @throws SmtpConfigNotFoundError
     */
    delete(

        configId: string,
        actingUserId: string
    ): Promise<void>;

    /**
     * Activate SMTP config (deactivates all others)
     * @throws SmtpConfigNotFoundError
     */
    activate(

        configId: string,
        actingUserId: string
    ): Promise<void>;
}
