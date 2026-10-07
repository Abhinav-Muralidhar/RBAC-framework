import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ConcurrentModificationError } from '../rbac/errors/rbac.errors';
import { errorHandler } from '../rbac/middleware/errorHandler.middleware';

describe('Optimistic Concurrency Control & Error Handling', () => {
    it('should format ConcurrentModificationError message properly with entity and id', () => {
        const error = new ConcurrentModificationError('Role', '101');
        expect(error.name).toBe('ConcurrentModificationError');
        expect(error.message).toBe("Role '101' was modified by another user. Please refresh and try again.");
    });

    it('should map ConcurrentModificationError to HTTP 409 Conflict with CONCURRENT_MODIFICATION code', () => {
        const error = new ConcurrentModificationError('User', '42');

        const req = { requestId: 'req-test-123' } as unknown as Request;
        const res = {
            statusCode: 200,
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as unknown as Response;
        const next: NextFunction = vi.fn();

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: null,
                error: expect.objectContaining({
                    code: 'CONCURRENT_MODIFICATION',
                    message: "User '42' was modified by another user. Please refresh and try again.",
                }),
                meta: expect.objectContaining({
                    requestId: 'req-test-123',
                }),
            })
        );
    });
});
