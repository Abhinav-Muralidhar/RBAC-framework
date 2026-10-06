/**
 * OrganizationService
 *
 * Business logic for organization management: creation, updates,
 * logo handling, and listing. All mutations are audit-logged.
 */
import { TransactionTask } from '../../utils/transaction.utils';
import { IOrganizationRepository } from '../repositories/organizations.repository';
import { Organizations } from '../models/organizations.model';
import { DuplicateAssignmentError, OrganizationNotFoundError } from '../errors/rbac.errors';
import { PaginationParams, PaginatedResult } from '../../utils/pagination.utils';
import { CreateOrganizationRequestDto, UpdateOrganizationRequestDto } from '../dto';
import { CreateFileInput, CreateOrganizationInput, OrganizationLogoCleanup, UploadedFileReference } from '../types/repository.types';
import { IAuditService } from '../services/audit.service';
import { deleteStoredUpload } from '../storage/file-storage';
import { IFilesRepository } from '../repositories/files.repository';
import path from 'node:path';
import {
    assertRequiredString,
    assertOptionalString,
    assertExactLength,
    assertDigitsLength,
    assertOptionalPhoneNumber,
    assertOptionalUrl,
    assertIntRange,
} from '../../utils/validators';

export interface IOrganizationService {
    /** Create a new organization with full validation. */
    createOrganization(t: TransactionTask, data: CreateOrganizationRequestDto, acting_user_id: string, auditCtx?: AuditContext): Promise<Organizations>;
    /** Retrieve a single organization by ID with audit-field names. */
    getOrganization(t: TransactionTask, id: string): Promise<Organizations>;
    /** List organizations with optional active/name filters and pagination. */
    getOrganizations(t: TransactionTask, filters?: { is_active?: boolean; name?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>>;
    /** Update an organization's attributes and optionally replace its logo file. */
    updateOrganization(t: TransactionTask, id: string, data: UpdateOrganizationRequestDto, actingUserId: string, auditCtx?: AuditContext, uploadedLogo?: UploadedFileReference): Promise<Organizations>;
}
const MODULE_CODE = 'SETTINGS';

export class OrganizationService implements IOrganizationService {
    constructor(
        private organizationRepository: IOrganizationRepository,
        private auditService: IAuditService,
        private filesRepository: IFilesRepository
    ) { }

    /**
     * Create a new organization with full field validation.
     * Checks for duplicate company_name before inserting.
     * @throws DuplicateAssignmentError if company_name already exists.
     */
    async createOrganization(
        t: TransactionTask,
        data: CreateOrganizationRequestDto,
        acting_user_id: string,
        auditCtx?: AuditContext
    ): Promise<Organizations> {
        assertRequiredString(data.company_name, 'Company name');
        assertRequiredString(data.company_logo, 'Company logo');
        assertRequiredString(data.address, 'Address');
        assertRequiredString(data.city, 'City');
        assertRequiredString(data.state, 'State');
        assertRequiredString(data.postal_code, 'Postal code');
        assertRequiredString(data.country, 'Country');
        assertRequiredString(data.country_code, 'Country code');
        assertRequiredString(data.gstin, 'GSTIN');
        assertDigitsLength(data.postal_code, 6, 'Postal code');
        assertExactLength(data.gstin, 15, 'GSTIN');
        assertDigitsLength(data.phone, 10, 'Phone');
        assertIntRange(data.financial_year_start_month, 1, 12, 'Financial year start month');
        assertOptionalUrl(data.website, 'Website');
        assertOptionalUrl(data.facebook, 'Facebook');
        assertOptionalUrl(data.twitter, 'Twitter');
        assertOptionalUrl(data.linkedin, 'LinkedIn');
        assertOptionalPhoneNumber(data.fax, 'Fax');
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

        const createdLogo = await this.filesRepository.create(t, {
            storage_path: data.company_logo,
            original_name: path.basename(data.company_logo),
            created_by: acting_user_id
        });

        const org: CreateOrganizationInput = {
            company_name: data.company_name,
            company_logo_file_id: createdLogo.id,
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
        organization.company_logo = createdLogo.storage_path;
        organization.company_logo_file_id = createdLogo.id;

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

    /** List organizations with optional active/name filters and pagination. */
    async getOrganizations(t: TransactionTask, filters?: { is_active?: boolean; name?: string }, pagination?: Partial<PaginationParams>): Promise<PaginatedResult<Organizations>> {
        return this.organizationRepository.getAll(t, filters, pagination);
    }

    /**
     * Retrieve a single organization by ID with creator/updater names.
     * @throws OrganizationNotFoundError if the organization does not exist.
     */
    async getOrganization(t: TransactionTask, id: string) {

        const organization = await this.organizationRepository.getByIdWithDetails(t, id);
        if (!organization) {
            throw new OrganizationNotFoundError(id);
        }
        return organization;
    }

    /**
     * Update an organization's attributes and optionally replace its logo file.
     * Deletes the previous logo from disk if a new one is uploaded.
     * @throws OrganizationNotFoundError if the organization does not exist.
     */
    async updateOrganization(
        t: TransactionTask,
        id: string,
        data: UpdateOrganizationRequestDto,
        actingUserId: string,
        auditCtx?: AuditContext,
        uploadedLogo?: UploadedFileReference
    ): Promise<Organizations> {
        assertOptionalString(data.company_name, 'Company name');
        assertOptionalString(data.company_logo, 'Company logo');
        assertOptionalString(data.address, 'Address');
        assertOptionalString(data.city, 'City');
        assertOptionalString(data.state, 'State');
        assertOptionalString(data.postal_code, 'Postal code');
        assertOptionalString(data.country, 'Country');
        assertOptionalString(data.country_code, 'Country code');
        assertOptionalString(data.gstin, 'GSTIN');
        assertDigitsLength(data.postal_code, 6, 'Postal code');
        assertExactLength(data.gstin, 15, 'GSTIN');
        assertDigitsLength(data.phone, 10, 'Phone');
        assertIntRange(data.financial_year_start_month, 1, 12, 'Financial year start month');
        assertOptionalUrl(data.website, 'Website');
        assertOptionalUrl(data.facebook, 'Facebook');
        assertOptionalUrl(data.twitter, 'Twitter');
        assertOptionalUrl(data.linkedin, 'LinkedIn');
        assertOptionalPhoneNumber(data.fax, 'Fax');
        const organization = await this.organizationRepository.getById(t, id);
        if (!organization) {
            throw new OrganizationNotFoundError(id);
        }

        let nextLogoPath = organization.company_logo as string;
        let nextLogoFileId = organization.company_logo_file_id;

        if (uploadedLogo) {
            const fileInput: CreateFileInput = {
                storage_path: uploadedLogo.storedPath,
                original_name: uploadedLogo.originalName,
                mime_type: uploadedLogo.mimeType,
                size_bytes: uploadedLogo.sizeBytes,
                created_by: actingUserId
            };
            const createdFile = await this.filesRepository.create(t, fileInput);
            nextLogoPath = uploadedLogo.storedPath;
            nextLogoFileId = createdFile.id;
        } else if (data.company_logo !== undefined && data.company_logo !== organization.company_logo) {
            const createdFile = await this.filesRepository.create(t, {
                storage_path: data.company_logo,
                original_name: path.basename(data.company_logo),
                created_by: actingUserId
            });
            nextLogoPath = data.company_logo;
            nextLogoFileId = createdFile.id;
        }

        const updated: Organizations = {
            id,
            version: data.version,
            company_name: data.company_name ?? organization.company_name as string,
            company_logo: organization.company_logo,
            company_logo_file_id: nextLogoFileId,
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
            updated_at: new Date(),
            updated_by: actingUserId
        };

        const updatedOrganization = await this.organizationRepository.update(t, updated);

        updatedOrganization.company_logo = nextLogoPath;
        updatedOrganization.company_logo_file_id = updated.company_logo_file_id;

        await this.auditService.log(t, {
            user_id: actingUserId,
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

    async cleanupReplacedLogo(cleanup: OrganizationLogoCleanup): Promise<void> {
        if (!cleanup.logoChanged) {
            return;
        }

        if (cleanup.previousLogoPath) {
            await deleteStoredUpload(cleanup.previousLogoPath, 'logos');
        }

        if (cleanup.previousLogoFileId) {
            await this.filesRepository.delete(undefined, cleanup.previousLogoFileId);
        }
    }
}
