import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationService } from '../rbac/services/evaluation.service';
import { IPermissionsRepository } from '../rbac/repositories/permissions.repository';
import { PermissionDeniedError } from '../rbac/errors/rbac.errors';
import { PermissionAction } from '../rbac/models/permissions.model';

describe('EvaluationService (RBAC Core Decision Engine)', () => {
    let permissionsRepository: IPermissionsRepository;
    let evaluationService: EvaluationService;

    beforeEach(() => {
        permissionsRepository = {
            findById: vi.fn(),
            findAll: vi.fn(),
            findByModuleAndAction: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findEffectsByUserAndModuleAction: vi.fn(),
            findByIds: vi.fn(),
        };
        evaluationService = new EvaluationService(permissionsRepository);
    });

    describe('evaluate()', () => {
        it('should DENY by default when no permission effects exist for user', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockResolvedValue([]);

            const decision = await evaluationService.evaluate(
                undefined,
                'user-123',
                'users',
                'read' as PermissionAction
            );

            expect(decision.granted).toBe(false);
            expect(decision.userId).toBe('user-123');
            expect(decision.moduleCode).toBe('users');
            expect(decision.action).toBe('read');
            expect(decision.reason).toContain('No permission found');
            expect(decision.hadExplicitDeny).toBe(false);
            expect(decision.hadExplicitAllow).toBe(false);
        });

        it('should ALLOW when an explicit allow effect is returned', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockResolvedValue(['allow']);

            const decision = await evaluationService.evaluate(
                undefined,
                'user-123',
                'users',
                'create' as PermissionAction
            );

            expect(decision.granted).toBe(true);
            expect(decision.hadExplicitAllow).toBe(true);
            expect(decision.hadExplicitDeny).toBe(false);
            expect(decision.reason).toContain('Permission granted');
        });

        it('should enforce DENY-OVER-ALLOW when both allow and deny effects are present', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockResolvedValue(['allow', 'deny']);

            const decision = await evaluationService.evaluate(
                undefined,
                'user-123',
                'roles',
                'delete' as PermissionAction
            );

            expect(decision.granted).toBe(false);
            expect(decision.hadExplicitDeny).toBe(true);
            expect(decision.hadExplicitAllow).toBe(true);
            expect(decision.reason).toContain('Explicit DENY');
        });

        it('should fail-closed and return DENY when repository throws an unexpected error', async () => {
            // Suppress console.error in test output for clean reporting
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockRejectedValue(
                new Error('Database connection failure')
            );

            const decision = await evaluationService.evaluate(
                undefined,
                'user-123',
                'roles',
                'read' as PermissionAction
            );

            expect(decision.granted).toBe(false);
            expect(decision.reason).toContain('failed due to internal error');
            spy.mockRestore();
        });
    });

    describe('enforcePermission()', () => {
        it('should resolve without throwing when permission is granted', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockResolvedValue(['allow']);

            await expect(
                evaluationService.enforcePermission('user-123', 'users', 'read')
            ).resolves.toBeUndefined();
        });

        it('should throw PermissionDeniedError when permission is not granted', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction).mockResolvedValue([]);

            await expect(
                evaluationService.enforcePermission('user-123', 'users', 'delete')
            ).rejects.toThrow(PermissionDeniedError);
        });
    });

    describe('evaluateBatch()', () => {
        it('should evaluate multiple permission requests concurrently', async () => {
            vi.mocked(permissionsRepository.findEffectsByUserAndModuleAction)
                .mockImplementation(async (_t, _userId, moduleCode, _action) => {
                    if (moduleCode === 'users') return ['allow'];
                    if (moduleCode === 'roles') return ['deny'];
                    return [];
                });

            const results = await evaluationService.evaluateBatch(
                undefined as any,
                'user-123',
                [
                    { moduleCode: 'users', action: 'read' },
                    { moduleCode: 'roles', action: 'write' },
                    { moduleCode: 'settings', action: 'update' },
                ]
            );

            expect(results).toHaveLength(3);
            expect(results[0]?.granted).toBe(true);
            expect(results[1]?.granted).toBe(false);
            expect(results[2]?.granted).toBe(false);
        });
    });
});
