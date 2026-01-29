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
import { RBACInternalError } from '../errors/rbac.errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const SALT_ROUNDS = 12; // Computationally expensive enough for 2026

/**
 * Get and validate encryption key from environment.
 * CRITICAL: Must be exactly 32 bytes (256 bits).
 * We expect a hex string of 64 chars in env var.
 */
function getEncryptionKey(): Buffer {
    // Ensure strict type checking env var
    const keyHex: string | undefined = process.env.RBAC_ENCRYPTION_KEY;

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
