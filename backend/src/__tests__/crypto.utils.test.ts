import { describe, it, expect, beforeAll } from 'vitest';
import {
    encryptAES,
    decryptAES,
    validatePassword,
    hashPassword,
    verifyPassword,
    encryptAuditLogForStorage,
    decryptAuditLogRow,
} from '../rbac/utils/crypto.utils';
import { InvalidPasswordError } from '../rbac/errors/rbac.errors';

describe('Crypto Utilities', () => {
    beforeAll(() => {
        // 64-character hex key (32 bytes) for AES-256-GCM tests
        process.env.RBAC_ENCRYPTION_KEY = 'a'.repeat(64);
    });

    describe('Password Validation & Bcrypt Hashing', () => {
        it('should accept strong passwords meeting complexity criteria', () => {
            expect(() => validatePassword('StrongP@ssw0rd!')).not.toThrow();
            expect(() => validatePassword('Secur1ty#2026')).not.toThrow();
        });

        it('should throw InvalidPasswordError when password is too short', () => {
            expect(() => validatePassword('Short1!')).toThrow(InvalidPasswordError);
        });

        it('should throw InvalidPasswordError when password lacks a number', () => {
            expect(() => validatePassword('NoNumbersHere!')).toThrow(InvalidPasswordError);
        });

        it('should throw InvalidPasswordError when password lacks a special character', () => {
            expect(() => validatePassword('NoSpecialChars123')).toThrow(InvalidPasswordError);
        });

        it('should correctly hash and verify passwords using bcrypt', async () => {
            const raw = 'SuperSecret#2026';
            const hash = await hashPassword(raw);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(raw);

            const isMatch = await verifyPassword(raw, hash);
            expect(isMatch).toBe(true);

            const isWrongMatch = await verifyPassword('WrongPassword#2026', hash);
            expect(isWrongMatch).toBe(false);
        });
    });

    describe('AES-256-GCM Reversible Encryption', () => {
        it('should encrypt and decrypt plaintext accurately round-trip', () => {
            const secret = 'smtp-ultra-secret-password-123';
            const encrypted = encryptAES(secret);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(secret);
            expect(encrypted.split(':')).toHaveLength(3); // iv:tag:content

            const decrypted = decryptAES(encrypted);
            expect(decrypted).toBe(secret);
        });

        it('should fail closed when decrypting tampered ciphertext', () => {
            const secret = 'sensitive-data';
            const encrypted = encryptAES(secret);
            const [iv, tag, content] = encrypted.split(':');

            // Corrupt the content
            const tamperedContent = (content || '').slice(0, -2) + 'ff';
            const corruptedCipher = `${iv}:${tag}:${tamperedContent}`;

            expect(() => decryptAES(corruptedCipher)).toThrow();
        });
    });

    describe('Audit Log Encryption / Decryption', () => {
        it('should encrypt audit log payloads and deserialize correctly', () => {
            const rawAuditInput: import('../rbac/types/repository.types').CreateAuditLogInput = {
                user_id: '10',
                role_id: '2',
                action: 'update',
                module_id: '1',
                entity_type: 'USER',
                entity_id: '15',
                old_values: { status: 'active', email: 'old@example.com' },
                new_values: { status: 'inactive', email: 'new@example.com' },
                ip_address: '192.168.1.100',
                user_agent: 'Mozilla/5.0 TestBrowser',
                status: 'success',
            };

            const encrypted = encryptAuditLogForStorage(rawAuditInput);
            expect(encrypted.action).not.toBe('update');

            const decrypted = decryptAuditLogRow({
                id: '1',
                ...encrypted,
            });

            expect(decrypted.id).toBe('1');
            expect(decrypted.action).toBe('update');
            expect(decrypted.entity_type).toBe('USER');
            expect(decrypted.entity_id).toBe('15');
            expect(decrypted.old_values).toEqual({ status: 'active', email: 'old@example.com' });
            expect(decrypted.new_values).toEqual({ status: 'inactive', email: 'new@example.com' });
            expect(decrypted.ip_address).toBe('192.168.1.100');
            expect(decrypted.status).toBe('success');
        });
    });
});
