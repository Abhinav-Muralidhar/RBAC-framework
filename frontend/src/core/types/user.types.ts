/**
 * User Types
 */

export type UserStatus = 'active' | 'inactive' | 'deleted';
export type SymbolPlacement = 'before' | 'after';
export type TrailingZeroHandling = 'show' | 'hide';

export interface User {
    id: string;
    version: number;

    username: string;
    password: string;

    status: UserStatus;

    first_name?: string | null;
    last_name: string;
    title?: string | null;
    department?: string | null;

    reports_to_user_id?: string | null;

    primary_email: string;
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

    created_at: Date;
    created_by?: string | null;
    rolesid: string;
    rolesname: string;
    groups?: Array<{ id: string; name: string }>;

    updated_at?: Date | null;
    updated_by?: string | null;
    last_login_at?: Date | null;
    password_changed_at?: Date | null;
}

export interface GetCurrentUserResponse {
    user: User;
    permissions: Record<string, Record<string, 'allow' | 'deny'>>;
}


export interface CreateUserDto {
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

    rolesid: string;
    rolesname?: string;
}

export interface UpdateUserDto {
    version: number;
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
    last_login_at?: Date | null;
    password_changed_at?: Date | null;
    rolesid?: string;
    rolesname?: string;
}

export interface UserSummaryDto {
    id: string;
    username: string;
    primary_email: string;
    first_name: string | null;
    last_name: string;
    status: UserStatus;
}

export interface UserListFilterDto {
    status: string,
    email: string,
    username: string,
    name: string
}
