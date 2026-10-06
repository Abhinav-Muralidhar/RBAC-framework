/**
 * Organization DTOs
 * 
 * Request, Response, and Filter DTOs for Organizations.
 */

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateOrganizationRequestDto {
    company_name: string;
    company_logo: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    country_code: string;
    gstin: string;
    phone?: string;
    fax?: string;
    website?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    financial_year_start_month?: number;
    is_active?: boolean;
    created_by?: string;
}


export interface UpdateOrganizationRequestDto {
    version: number;
    company_name?: string;
    company_logo?: string;
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
    created_by?: string;
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface OrganizationListFilterDto {
    is_active?: boolean;
    country?: string;
    state?: string;
    city?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface OrganizationResponseDto {
    id: string;
    version: number;
    company_name: string;
    company_logo: string;
    company_logo_file_id: string | null;
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
    created_by_name: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    updated_by_name: string | null;
}

export interface OrganizationSummaryDto {
    id: string;
    company_name: string;
    is_active: boolean;
}
