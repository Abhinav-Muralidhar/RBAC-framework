/**
 * Centralized Validators
 * 
 * All form validation functions for the RBAC frontend.
 */

/**
 * Validate password strength
 * - Minimum 8 characters
 * - At least 1 number
 * - At least 1 special character
 */
export function validatePassword(password: string): string | null {
    if (!password) {
        return 'Password is required';
    }
    if (password.length < 8) {
        return 'Password must be at least 8 characters';
    }
    if (!/\d/.test(password)) {
        return 'Password must contain at least 1 number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password)) {
        return 'Password must contain at least 1 special character';
    }
    return null;
}

/**
 * Validate confirm password matches
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
    if (!confirmPassword) {
        return 'Please confirm your password';
    }
    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }
    return null;
}

/**
 * Validate OTP
 * - Exactly 6 characters
 * - Alphanumeric only
 */
export function validateOtp(otp: string): string | null {
    if (!otp) {
        return 'Verification code is required';
    }
    if (otp.length !== 6) {
        return 'Verification code must be exactly 6 characters';
    }
    if (!/^[a-zA-Z0-9]+$/.test(otp)) {
        return 'Verification code must be alphanumeric only';
    }
    return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string | null {
    if (!email) {
        return 'Email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Invalid email format';
    }
    return null;
}

/**
 * Validate required field
 */
export function validateRequired(value: string | undefined | null, fieldName: string): string | null {
    if (!value || !value.trim()) {
        return `${fieldName} is required`;
    }
    return null;
}

/**
 * Validate username
 */
export function validateUsername(username: string): string | null {
    if (!username) {
        return 'Username is required';
    }
    if (username.length < 3) {
        return 'Username must be at least 3 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
}

/**
 * Validate role/group code format
 */
export function validateCode(code: string): string | null {
    if (!code) {
        return 'Code is required';
    }
    if (!/^[A-Z_]+$/.test(code)) {
        return 'Code must be uppercase letters and underscores only';
    }
    return null;
}

/**
 * Validate port number
 */
export function validatePort(port: number | string): string | null {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return 'Port must be between 1 and 65535';
    }
    return null;
}
