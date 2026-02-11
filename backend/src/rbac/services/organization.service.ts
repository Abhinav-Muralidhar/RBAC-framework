import { TransactionTask } from '../utils/transaction.utils';
import { IOrganizationRepository } from '../repositories/organizations.repository';
import { Organizations } from '../models/organizations.model';
import { DuplicateAssignmentError, OrganizationNotFoundError } from '../errors/rbac.errors';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { CreateOrganizationRequestDto, UpdateOrganizationRequestDto } from '../dto';
import { CreateOrganizationInput } from '../types/repository.types';
import { IAuditService } from '../services/audit.service';

export interface IOrganizationService {
    createOrganization(t: TransactionTask, data: CreateOrganizationRequestDto, acting_user_id: string, auditCtx?: AuditContext): Promise<Organizations>;
    getOrganization(t: TransactionTask, id: string): Promise<Organizations>;
    getOrganizations(t: TransactionTask, filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>>;
    updateOrganization(t: TransactionTask, id: string, data: UpdateOrganizationRequestDto, auditCtx?: AuditContext): Promise<Organizations>;
}
const MODULE_CODE = 'SETTINGS';

export class OrganizationService implements IOrganizationService {
    constructor(
        private organizationRepository: IOrganizationRepository,
        private auditService: IAuditService
    ) { }

    async createOrganization(
        t: TransactionTask,
        data: CreateOrganizationRequestDto,
        acting_user_id: string,
        auditCtx?: AuditContext
    ): Promise<Organizations> {
        const existing = await this.organizationRepository.getAll(
            t,
            { name: data.company_name },
            { page: 1, limit: 1 }
        );

        if (existing.data.length > 0) {
            throw new DuplicateAssignmentError(
                `organization name '${data.company_name}'`
            );
        }

        const org: CreateOrganizationInput = {
            company_name: data.company_name,
            company_logo: data.company_logo,
            address: data.address,
            city: data.city,
            state: data.state,
            postal_code: data.postal_code,
            country: data.country,
            country_code: data.country_code,
            phone: data.phone as string,
            fax: data.fax as string,
            website: data.website as string,
            facebook: data.facebook as string,
            twitter: data.twitter as string,
            linkedin: data.linkedin as string,
            financial_year_start_month: data.financial_year_start_month as number,
            gstin: data.gstin as string,
            is_active: true,
            created_by: acting_user_id
        };

        const organization = await this.organizationRepository.create(t, org);

        await this.auditService.log(t, {
            user_id: acting_user_id,
            action: 'create',
            module_code: MODULE_CODE,
            entity_type: 'organization',
            entity_id: organization.id,
            old_values: null,
            new_values: { ...org } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });

        return organization;

    }

    async getOrganizations(t: TransactionTask, filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>> {
        return this.organizationRepository.getAll(t, filters, pagination);
    }

    async getOrganization(t: TransactionTask, id: string): Promise<Organizations> {

        const organization = await this.organizationRepository.getById(t, id);
        if (!organization) {
            throw new OrganizationNotFoundError(id);
        }
        return organization;
    }

    async updateOrganization(
        t: TransactionTask,
        id: string,
        data: UpdateOrganizationRequestDto,
        auditCtx?: AuditContext
    ): Promise<Organizations> {
        const organization = await this.organizationRepository.getById(t, id);
        if (!organization) {
            throw new OrganizationNotFoundError(id);
        }

        const updated: Organizations = {
            id,
            company_name: data.company_name ?? organization.company_name as string,
            company_logo: data.company_logo ?? organization.company_logo as string,
            address: data.address ?? organization.address as string,
            city: data.city ?? organization.city as string,
            state: data.state ?? organization.state as string,
            postal_code: data.postal_code ?? organization.postal_code as string,
            country: data.country ?? organization.country as string,
            country_code: data.country_code ?? organization.country_code as string,
            phone: data.phone ?? organization.phone as string,
            fax: data.fax ?? organization.fax as string,
            website: data.website ?? organization.website as string,
            facebook: data.facebook ?? organization.facebook as string,
            twitter: data.twitter ?? organization.twitter as string,
            linkedin: data.linkedin ?? organization.linkedin as string,
            financial_year_start_month:
                data.financial_year_start_month ??
                organization.financial_year_start_month as number,
            gstin: data.gstin ?? organization.gstin as string,
            is_active: data.is_active ?? organization.is_active,
            created_by: organization.created_by as string | null,
            created_at: organization.created_at,
            updated_at: new Date()
        };

        const updatedOrganization = await this.organizationRepository.update(t, updated);
        await this.auditService.log(t, {
            user_id: id,
            action: 'update',
            module_code: MODULE_CODE,
            entity_type: 'organization',
            entity_id: id,
            old_values: { ...organization } as Record<string, unknown>,
            new_values: { ...updated } as Record<string, unknown>,
            ip_address: auditCtx?.ip_address,
            user_agent: auditCtx?.user_agent,
            status: 'success'
        });
        return updatedOrganization;
    }
}