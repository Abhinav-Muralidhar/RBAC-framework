
import { IOrganizationRepository } from '../repositories/organizations.repository';
import { Organizations } from '../models/organizations.model';
import { RBACInternalError } from '../errors/rbac.errors';

export interface IOrganizationService {
    createOrganization(
        data: Omit<Organizations, 'id' | 'created_at' | 'updated_at'>,
    ): Promise<Organizations>;

    getOrganization(id: string): Promise<Organizations>;
}
