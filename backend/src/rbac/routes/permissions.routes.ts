import { Router } from 'express';
import { IPermissionsRepository } from '../repositories/permissions.repository';

export function createPermissionsRouter(
    permissionsRepository: IPermissionsRepository
): Router {
    const router = Router();

    /**
     * GET /rbac/permissions
     * Read-only permission metadata for UI
     */
    router.get('/', async (req, res, next) => {
        try {
            const permissions = await permissionsRepository.findAll(undefined);

            res.json(
                permissions.map(p => ({
                    id: p.id,
                    module_id: p.module_id,
                    action: p.action,
                    description: p.description
                }))
            );
        } catch (err) {
            next(err);
        }
    });

    return router;
}
