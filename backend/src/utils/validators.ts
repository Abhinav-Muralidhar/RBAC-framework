import net from 'node:net';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const DIGITS_REGEX = /^\d+$/;
const CODE_REGEX = /^[A-Z_]+$/;
const OTP_REGEX = /^[a-zA-Z0-9]{6}$/;
const E164_REGEX = /^\+\d{1,4}$/;

function isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
}

export function assertRequiredString(value: unknown, fieldName: string): void {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${fieldName} is required`);
    }
}

export function assertOptionalString(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${fieldName} must be a non-empty string`);
    }
}

export function assertRequiredEmail(value: unknown, fieldName: string): void {
    assertRequiredString(value, fieldName);
    if (!EMAIL_REGEX.test(value as string)) {
        throw new Error(`${fieldName} must be a valid email`);
    }
}

export function assertOptionalEmail(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
        throw new Error(`${fieldName} must be a valid email`);
    }
}

export function assertOptionalUrl(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !URL_REGEX.test(value)) {
        throw new Error(`${fieldName} must be a valid URL`);
    }
}

export function assertExactLength(value: unknown, length: number, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || value.trim().length !== length) {
        throw new Error(`${fieldName} must be exactly ${length} characters`);
    }
}

export function assertDigitsLength(value: unknown, length: number, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !DIGITS_REGEX.test(value.trim())) {
        throw new Error(`${fieldName} must contain digits only`);
    }
    if (value.trim().length !== length) {
        throw new Error(`${fieldName} must be exactly ${length} digits`);
    }
}

export function assertOptionalPhoneNumber(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} must be a string`);
    }
    if (!/^[0-9+()\-\s.]+$/.test(value)) {
        throw new Error(`${fieldName} contains invalid characters`);
    }
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
        throw new Error(`${fieldName} must be between 7 and 15 digits`);
    }
}

export function assertOptionalE164(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !E164_REGEX.test(value)) {
        throw new Error(`${fieldName} must look like +1`);
    }
}

export function assertInEnum(value: unknown, allowed: readonly string[], fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new Error(`${fieldName} is invalid`);
    }
}

export function assertIntRange(value: unknown, min: number, max: number, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${fieldName} must be an integer between ${min} and ${max}`);
    }
}

export function assertOptionalBoolean(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'boolean') {
        throw new Error(`${fieldName} must be a boolean`);
    }
}

export function assertOptionalIpAddress(value: unknown, fieldName: string): void {
    if (isEmpty(value) || value === 'unknown') return;
    if (typeof value !== 'string' || net.isIP(value) === 0) {
        throw new Error(`${fieldName} must be a valid IP address`);
    }
}

export function assertOtpCode(value: unknown, fieldName: string): void {
    if (typeof value !== 'string' || !OTP_REGEX.test(value)) {
        throw new Error(`${fieldName} must be 6 alphanumeric characters`);
    }
}

export function assertCodeFormat(value: unknown, fieldName: string): void {
    if (isEmpty(value)) return;
    if (typeof value !== 'string' || !CODE_REGEX.test(value)) {
        throw new Error(`${fieldName} must be uppercase letters and underscores only`);
    }
}

export function normalizeStringArray(value: unknown, fieldName: string): string[] {
    if (isEmpty(value)) return [];
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.trim() === '') {
            throw new Error(`${fieldName} must contain non-empty strings`);
        }
        const trimmed = item.trim();
        if (!seen.has(trimmed)) {
            seen.add(trimmed);
            result.push(trimmed);
        }
    }
    return result;
}
