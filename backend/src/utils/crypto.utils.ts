/**
 * Cryptographic Utilities
 * 
 * Centralized crypto functions for RBAC system.
 * Implements:
 * - AES-256-GCM for reversible encryption (e.g. SMTP passwords)
 * - Bcrypt for one-way password hashing (users)
 * 
 * Strict reliance on environment variables for keys.
 * Fail-closed on any error.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { RBACInternalError, InvalidPasswordError } from '../rbac/errors/rbac.errors';
import { getSecretValue } from './secret.utils';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const SALT_ROUNDS = 12; // Computationally expensive enough for 2026

/**
 * Get and validate encryption key from environment.
 * CRITICAL: Must be exactly 32 bytes (256 bits).
 * We expect a hex string of 64 chars in env var.
 */
function getEncryptionKey(): Buffer {
    const keyHex = getSecretValue('RBAC_ENCRYPTION_KEY');

    if (!keyHex) {
        throw new RBACInternalError('RBAC_ENCRYPTION_KEY environment variable is missing');
    }

    // We strictly assume the key is passed as a Hex string to ensure it's printable and managed easily in envs
    if (keyHex.length !== 64) {
        throw new RBACInternalError('RBAC_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    try {
        return Buffer.from(keyHex, 'hex');
    } catch (error) {
        throw new RBACInternalError('Failed to parse RBAC_ENCRYPTION_KEY', error as Error);
    }
}

function getAuditHmacKey(): string {
    const key = getSecretValue('RBAC_AUDIT_HMAC_KEY');
    if (!key || !key.trim()) {
        throw new RBACInternalError('RBAC_AUDIT_HMAC_KEY environment variable is missing');
    }
    return key.trim();
}

/**
 * Encrypt sensitive text using AES-256-GCM.
 * Output format: "iv:authTag:encryptedContent" (all hex encoded)
 */
export function encryptAES(text: string): string {
    if (!text) {
        throw new RBACInternalError('Encryption text cannot be empty');
    }

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');
        const ivHex = iv.toString('hex');

        // Layout: IV (16) + Tag (16) + Content (Variable)
        // We join with ':' for readability and parsing safety
        return `${ivHex}:${authTag}:${encrypted}`;
    } catch (error) {
        // Obfuscate the actual error but log if necessary? 
        // User rule: Throw domain errors only.
        // We wrap in RBACInternalError.
        throw new RBACInternalError('Encryption failed', error as Error);
    }
}

/**
 * Decrypt sensitive text using AES-256-GCM.
 * Expects format: "iv:authTag:encryptedContent"
 */
export function decryptAES(cipherText: string): string {
    if (!cipherText) {
        throw new RBACInternalError('Ciphertext cannot be empty');
    }

    try {
        const parts = cipherText.split(':');
        if (parts.length !== 3) {
            throw new RBACInternalError('Invalid ciphertext format');
        }

        // Assertion to ensure TypeScript knows these are strings
        const [ivHex, authTagHex, contentHex] = parts as [string, string, string];

        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(contentHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // CRITICAL: Fail closed on decryption error (wrong key, tampering, etc)
        throw new RBACInternalError('Decryption failed', error as Error);
    }
}

/**
 * Validate password strength.
 * 
 * Rules:
 * - Not null/empty
 * - Minimum 8 characters
 * - At least 1 number
 * - At least 1 special character
 * 
 * @throws InvalidPasswordError if validation fails
 */
export function validatePassword(password: string | null | undefined): void {
    if (!password) {
        throw new InvalidPasswordError('Password is required');
    }

    if (password.length < 8) {
        throw new InvalidPasswordError('Password must be at least 8 characters');
    }

    if (!/\d/.test(password)) {
        throw new InvalidPasswordError('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        throw new InvalidPasswordError('Password must contain at least one special character');
    }
}

/**
 * Hash a password using Bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
    if (!plainText) {
        throw new RBACInternalError('Password cannot be empty');
    }

    try {
        const hash = await bcrypt.hash(plainText, SALT_ROUNDS);
        return hash;
    } catch (error) {
        throw new RBACInternalError('Password hashing failed', error as Error);
    }
}

/**
 * Verify a password against a hash using Bcrypt.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
    if (!plainText || !hash) {
        return false;
    }

    try {
        const isValid = await bcrypt.compare(plainText, hash);
        return isValid;
    } catch (error) {
        // On error, return false to fail closed, or throw? 
        // If system error, we verify strictly so we throw to indicate broken verify process
        throw new RBACInternalError('Password verification failed', error as Error);
    }
}

function canonicalizeLogFilterValue(value: string): string {
    return value.trim().toLowerCase();
}

export function computeLogHmac(value: string): string {
    const normalized = canonicalizeLogFilterValue(value);
    const key = getAuditHmacKey();
    return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('hex');
}

/** Encrypt a non-null string; return null for null/undefined */
function encryptField(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return encryptAES(value);
}

/** Decrypt a non-null ciphertext; return null for null/undefined */
function decryptField(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return decryptAES(value);
}

/**
 * Encrypt all log fields before database persistence.
 * Returns an object with all-string encrypted values ready for INSERT.
 */
export function encryptLogForStorage(input: {
    user_id?: string | null;
    role_id?: string | null;
    action: string;
    module_id?: string | null;
    entity_type: string;
    entity_id?: string | null;
    old_values?: unknown | null;
    new_values?: unknown | null;
    ip_address?: string | null;
    user_agent?: string | null;
    status: string;
}): any {
    return {
        user_id: encryptField(input.user_id),
        role_id: encryptField(input.role_id),
        action: encryptAES(input.action),
        module_id: encryptField(input.module_id),
        entity_type: encryptAES(input.entity_type),
        entity_id: encryptField(input.entity_id),
        old_values: input.old_values
            ? encryptAES(JSON.stringify(input.old_values))
            : null,
        new_values: input.new_values
            ? encryptAES(JSON.stringify(input.new_values))
            : null,
        ip_address: input.ip_address ? encryptAES(input.ip_address) : null,
        user_agent: input.user_agent ? encryptAES(input.user_agent) : null,
        status: encryptAES(input.status),
        created_at: encryptAES(new Date().toISOString()),
        hmac_entity_type: computeLogHmac(input.entity_type),
        hmac_action: computeLogHmac(input.action),
        hmac_user_id: input.user_id ? computeLogHmac(input.user_id) : null,
    };
}

/**
 * Decrypt a raw encrypted row from the database.
 */
export function decryptLogRow(row: any): any {
    const oldValuesStr = decryptField(row.old_values);
    const newValuesStr = decryptField(row.new_values);

    return {
        id: row.id,
        user_id: decryptField(row.user_id),
        role_id: decryptField(row.role_id),
        action: decryptAES(row.action),
        module_id: decryptField(row.module_id),
        entity_type: decryptAES(row.entity_type),
        entity_id: decryptField(row.entity_id),
        old_values: oldValuesStr ? JSON.parse(oldValuesStr) : null,
        new_values: newValuesStr ? JSON.parse(newValuesStr) : null,
        ip_address: decryptField(row.ip_address),
        user_agent: decryptField(row.user_agent),
        status: decryptAES(row.status),
        created_at: new Date(decryptAES(row.created_at)),
    };
}

/**
 * Decrypt a minimal log row for list views.
 */
export function decryptLogListRow(row: any): any {
    return {
        id: row.id,
        user_id: decryptField(row.user_id),
        action: decryptAES(row.action),
        entity_type: decryptAES(row.entity_type),
        entity_id: decryptField(row.entity_id),
        status: decryptAES(row.status),
        ip_address: decryptField(row.ip_address),
        created_at: new Date(decryptAES(row.created_at)),
    };
}

/**
 * Generate HMAC filters for searching encrypted logs.
 */
export function getLogHmacFilters(filters?: {
    action?: string | undefined;
    entity_type?: string | undefined;
    user_id?: string | undefined;
    search?: string | undefined;
}): { hmac_action?: string; hmac_entity_type?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] } {
    const hmacFilters: { hmac_action?: string; hmac_entity_type?: string; hmac_user_id?: string; search_hmac?: string; search?: string; search_user_hmacs?: string[] } = {};
    if (filters?.action) hmacFilters.hmac_action = computeLogHmac(filters.action);
    if (filters?.entity_type) hmacFilters.hmac_entity_type = computeLogHmac(filters.entity_type);
    if (filters?.user_id) hmacFilters.hmac_user_id = computeLogHmac(filters.user_id);
    if (filters?.search) {
        hmacFilters.search_hmac = computeLogHmac(filters.search);
        hmacFilters.search = filters.search;
    }
    return hmacFilters;
}
