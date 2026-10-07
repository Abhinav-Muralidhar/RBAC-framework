import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createAuthenticateMiddleware } from '../rbac/middleware/authenticate.middleware';
import { IAuthSessionService } from '../rbac/services/authSession.service';
import { ApiError } from '../rbac/errors/api.errors';

describe('Authenticate Middleware', () => {
    let authSessionService: Partial<IAuthSessionService>;
    let authenticate: ReturnType<typeof createAuthenticateMiddleware>;

    beforeEach(() => {
        authSessionService = {
            resolveSession: vi.fn(),
            isValid: vi.fn(),
        };
        authenticate = createAuthenticateMiddleware(authSessionService as IAuthSessionService);
    });

    it('should reject request with 401 when sessionToken signed cookie is missing', async () => {
        const req = {
            signedCookies: {},
        } as unknown as Request;
        const res = {} as Response;
        const next: NextFunction = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ApiError));
        const error = (next as any).mock.calls[0][0] as ApiError;
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTH_REQUIRED');
    });

    it('should reject request with 401 when session token is invalid or expired', async () => {
        vi.mocked(authSessionService.resolveSession!).mockResolvedValue(null as unknown as any);

        const req = {
            signedCookies: { sessionToken: 'invalid-token-123' },
        } as unknown as Request;
        const res = {} as Response;
        const next: NextFunction = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ApiError));
        const error = (next as any).mock.calls[0][0] as ApiError;
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('INVALID_SESSION');
    });

    it('should populate req.user and call next() when valid sessionToken is provided', async () => {
        vi.mocked(authSessionService.resolveSession!).mockResolvedValue({
            id: 'session-999',
            user_id: 'user-888',
            ip_address: '127.0.0.1',
            user_agent: 'Vitest/TestRunner',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
            updated_at: null,
            is_revoked: false,
        } as any);

        const req = {
            signedCookies: { sessionToken: 'valid-token-abc' },
            user: undefined,
        } as unknown as Request;
        const res = {} as Response;
        const next: NextFunction = vi.fn();

        await authenticate(req, res, next);

        expect(req.user).toEqual({
            id: 'user-888',
            sessionId: 'session-999',
        });
        expect(next).toHaveBeenCalledWith();
    });
});
