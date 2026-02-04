/**
 * User Types
 */

export type UserStatus = 'active' | 'inactive' | 'deleted';

export interface User {
    id: string;
    username: string;
    status: UserStatus;
    first_name: string | null;
    last_name: string;
    title: string | null;
    department: string | null;
    primary_email: string;
    secondary_email: string | null;
    other_email: string | null;

    // Phones
    office_phone: string | null;
    mobile_phone: string | null;
    home_phone: string | null;
    secondary_phone: string | null;
    fax: string | null;
    phone_country_code: string | null;

    // Address
    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;

    // Preferences
    time_zone: string | null;
    preferred_currency: string | null;
    name_format: string | null;
    default_landing_page: string | null;
    full_screen_preview: boolean | null;

    digit_grouping_pattern: string | null;
    decimal_separator: string | null;
    decimal_precision: number | null;
    symbol_placement: 'before' | 'after' | null;
    trailing_zero_handling: 'show' | 'hide' | null;
    aggregation_format: string | null;

    // Work / UI
    business_hours: Record<string, any> | null;
    signature: string | null;

    // Relations (read-only)
    created_by: number | null;

    // Audit
    updated_at: string | null;
    password_changed_at: string | null;
    reports_to_user_id: string | null;
    reports_to_user_name: string | null;
    roles?: Array<{ id: string; name: string; code: string }>;
    groups?: Array<{ id: string; name: string }>;
    created_at: string;
    last_login_at: string | null;
}

export interface CreateUserDto {
    username: string;
    password: string;
    primary_email: string;
    last_name: string;
    first_name?: string;
    title?: string;
    department?: string;
    role_ids?: string[];
}

export interface UpdateUserDto {
    username?: string;
    password?: string;
    status?: 'active' | 'inactive';
    first_name?: string;
    last_name?: string;
    title?: string;
    department?: string;
    primary_email?: string;
    secondary_email?: string | null;
    other_email?: string | null;
    role_ids?: string[];
    mobile_phone?: string | null;
    office_phone?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    time_zone?: string | null;
    preferred_currency?: string | null;
    full_screen_preview?: boolean | null;
    signature?: string | null;
}
