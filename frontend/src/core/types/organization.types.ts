/**
 * Organization Types
 */

export type OrganizationStatus = 'active' | 'inactive';

export interface Organization {
    id: string;

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
    created_at: string;
    created_by: string | null;
    updated_at: string | null;
}

/**
 * Update Organization DTO
 * (No create / delete for now)
 */
export interface UpdateOrganizationDto {
    company_name?: string;
    company_logo?: string | null;

    address?: string;
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
