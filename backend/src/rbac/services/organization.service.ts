import { IDatabase } from 'pg-promise';
import { TransactionTask, withTransaction } from '../utils/transaction.utils';
import { IOrganizationRepository } from '../repositories/organizations.repository';
import { Organizations } from '../models/organizations.model';
import { DuplicateAssignmentError, OrganizationNotFoundError } from '../errors/rbac.errors';
import { PaginationParams, PaginatedResult } from '../utils/pagination.utils';
import { CreateOrganizationRequestDto, UpdateOrganizationRequestDto } from '../dto';
import { CreateOrganizationInput } from '../types/repository.types';
import { IAuditService } from '../services/audit.service';

export interface IOrganizationService {
    createOrganization(data: CreateOrganizationRequestDto, acting_user_id: string): Promise<Organizations>;
    getOrganization(id: string): Promise<Organizations>;
    getOrganizations(filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>>;
    updateOrganization(id: string, data: UpdateOrganizationRequestDto): Promise<Organizations>;
}

export class OrganizationService implements IOrganizationService {
    constructor(
        private organizationRepository: IOrganizationRepository,
        private auditService: IAuditService
    ) { }

    async createOrganization(
        data: CreateOrganizationRequestDto,
        acting_user_id: string
    ): Promise<Organizations> {
        return withTransaction(async (t: TransactionTask) => {
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

            return this.organizationRepository.create(t, org);
        });
    }

    async getOrganizations(filters?: { is_active?: boolean; name?: string; code?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>> {
        return withTransaction(async (t: TransactionTask) => {
            return this.organizationRepository.getAll(t, filters, pagination);
        });
    }

    async getOrganization(id: string): Promise<Organizations> {
        return withTransaction(async (t: TransactionTask) => {
            const organization = await this.organizationRepository.getById(t, id);
            if (!organization) {
                throw new OrganizationNotFoundError(id);
            }
            return organization;
        });
    }

    async updateOrganization(
        id: string,
        data: UpdateOrganizationRequestDto
    ): Promise<Organizations> {
        return withTransaction(async (t: TransactionTask) => {
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

            const c = await this.organizationRepository.update(t, updated);
            this.auditService.log(t, {
                user_id: id,
                action: 'update',
                entity_type: 'organization',
                entity_id: id,
                old_values: JSON.parse(JSON.stringify(organization)),
                new_values: JSON.parse(JSON.stringify(updated)),
                status: 'success'
            });
            return c;
        });
    }
}