/**
 * Organization Types
 */

export type OrganizationStatus = 'active' | 'inactive';

export interface Organization {
    id: string;
    version: number;

    // Core
    company_name: string;
    company_logo: string | null;

    // Address
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    country_code: string;

    // Contact
    phone: string | null;
    fax: string | null;
    website: string | null;

    // Social
    facebook: string | null;
    twitter: string | null;
    linkedin: string | null;

    // Business
    financial_year_start_month: number | null; // 1–12
    gstin: string; // read-only in UI

    // Status
    is_active: boolean;

    // Audit (read-only)
    created_at: Date | null;
    created_by: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    created_by_name: string | null;
    updated_by_name: string | null;
}

/**
 * Update Organization DTO
 * (No create / delete for now)
 */
export interface UpdateOrganizationDto {
    version: number;
    company_name?: string;
    company_logo?: string | null;

    address?: string;
    gstin?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    country_code?: string;

    phone?: string | null;
    fax?: string | null;
    website?: string | null;

    facebook?: string | null;
    twitter?: string | null;
    linkedin?: string | null;

    financial_year_start_month?: number | null;

    is_active?: boolean;
}


export interface OrganizationResponseDto {
    id: string;
    version: number;
    company_name: string;
    company_logo: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    country_code: string;
    phone: string | null;
    fax: string | null;
    website: string | null;
    facebook: string | null;
    twitter: string | null;
    linkedin: string | null;
    financial_year_start_month: number | null;
    gstin: string;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    created_by_name: string | null;
    updated_by_name: string | null;
}

export interface OrganizationSummaryDto {
    id: string;
    company_name: string;
    is_active: boolean;
}

export interface OrganizationListFilterDto {
    is_active?: boolean;
    country?: string;
    state?: string;
    city?: string;
}

/**
 * Public branding DTO (no auth required)
 * Used by login page, sidebar, etc.
 */
export interface OrganizationBrandingDto {
    company_name: string;
    company_logo: string | null;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    country_code: string;
    phone: string | null;
    fax: string | null;
    website: string | null;
    facebook: string | null;
    twitter: string | null;
    linkedin: string | null;
    gstin: string;
}
