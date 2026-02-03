/**
 * User DTOs
 * 
 * Request, Response, and Filter DTOs for Users.
 * Complete field coverage from users.model.ts
 */

import { UserStatus, SymbolPlacement, TrailingZeroHandling } from '../models/users.model';

// ============================================================================
// REQUEST DTOs
// ============================================================================

/**
 * Create User Request DTO
 * All fields required for user creation
 */
export interface CreateUserRequestDto {
    // Required fields
    username: string;
    password: string;
    primary_email: string;
    last_name: string;

    // Optional fields
    first_name?: string;
    title?: string;
    department?: string;
    reports_to_user_id?: string;

    // Additional emails
    secondary_email?: string;
    other_email?: string;

    // Phone numbers
    office_phone?: string;
    mobile_phone?: string;
    home_phone?: string;
    secondary_phone?: string;
    fax?: string;

    // Address
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;

    // Preferences
    default_landing_page?: string;
    name_format?: string;
    phone_country_code?: string;
    full_screen_preview?: boolean;

    // Currency/number settings
    preferred_currency?: string;
    digit_grouping_pattern?: string;
    decimal_separator?: string;
    decimal_precision?: number;
    symbol_placement?: SymbolPlacement;
    trailing_zero_handling?: TrailingZeroHandling;

    // Time/business settings
    time_zone?: string;
    business_hours?: Record<string, unknown>;

    // Other
    aggregation_format?: string;
    signature?: string;
}

/**
 * Update User Request DTO
 * All fields optional for partial updates
 */
export interface UpdateUserRequestDto {
    username?: string;
    password?: string;  // Will trigger validation if provided
    status?: Exclude<UserStatus, 'deleted'>;  // Cannot set to 'deleted' via update

    first_name?: string;
    last_name?: string;
    title?: string;
    department?: string;
    reports_to_user_id?: string | null;

    primary_email?: string;
    secondary_email?: string | null;
    other_email?: string | null;

    office_phone?: string | null;
    mobile_phone?: string | null;
    home_phone?: string | null;
    secondary_phone?: string | null;
    fax?: string | null;

    street?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;

    default_landing_page?: string | null;
    name_format?: string | null;
    phone_country_code?: string | null;
    full_screen_preview?: boolean | null;

    preferred_currency?: string | null;
    digit_grouping_pattern?: string | null;
    decimal_separator?: string | null;
    decimal_precision?: number | null;
    symbol_placement?: SymbolPlacement | null;
    trailing_zero_handling?: TrailingZeroHandling | null;

    time_zone?: string | null;
    business_hours?: Record<string, unknown> | null;

    aggregation_format?: string | null;
    signature?: string | null;
}

// ============================================================================
// FILTER DTOs
// ============================================================================

/**
 * User List Filter DTO
 * Whitelisted query parameters for listing users
 */
export interface UserListFilterDto {
    status: string,
    email: string,
    username: string,
    name: string
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * User Response DTO
 * Safe fields to return to clients (excludes password)
 * Includes JOINed data for human-readable context
 */
export interface UserResponseDto {
    id: string;
    username: string;
    status: UserStatus;

    first_name: string | null;
    last_name: string;
    title: string | null;
    department: string | null;

    // Manager (JOINed)
    reports_to_user_id: string | null;
    reports_to_user_name: string | null;   // JOINed: manager's first_name + ' ' + last_name

    primary_email: string;
    secondary_email: string | null;
    other_email: string | null;

    office_phone: string | null;
    mobile_phone: string | null;
    home_phone: string | null;
    secondary_phone: string | null;
    fax: string | null;

    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;

    default_landing_page: string | null;
    name_format: string | null;
    phone_country_code: string | null;
    full_screen_preview: boolean | null;

    preferred_currency: string | null;
    digit_grouping_pattern: string | null;
    decimal_separator: string | null;
    decimal_precision: number | null;
    symbol_placement: SymbolPlacement | null;
    trailing_zero_handling: TrailingZeroHandling | null;

    time_zone: string | null;
    business_hours: Record<string, unknown> | null;

    aggregation_format: string | null;
    signature: string | null;

    // Assigned roles (JOINed)
    roles?: Array<{ id: string; name: string; code: string }>;

    // Assigned groups (JOINed)
    groups?: Array<{ id: string; name: string }>;

    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;        // JOINed: creator's first_name + ' ' + last_name
    updated_at: Date | null;
    last_login_at: Date | null;
    password_changed_at: Date | null;
}

/**
 * User Summary DTO
 * Minimal fields for lists and references
 */
export interface UserSummaryDto {
    id: string;
    username: string;
    primary_email: string;
    first_name: string | null;
    last_name: string;
    status: UserStatus;
}
