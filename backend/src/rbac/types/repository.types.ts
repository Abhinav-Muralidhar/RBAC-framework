/**
 * Strict Repository Input Types
 * 
 * These types enforce compile-time validation of required fields.
 * NO Partial<T> - every field is explicitly required or optional.
 * Based on database migrations.
 */

// ============================================================
// USERS
// ============================================================

/** Required fields for creating a user (from 02_users.js migration) */
export interface CreateUserInput {
    username: string;
    password: string;
    last_name: string;
    primary_email: string;
    // Optional fields (nullable in DB)
    status?: 'active' | 'inactive' | 'deleted';
    first_name?: string | null;
    title?: string | null;
    department?: string | null;
    reports_to_user_id?: string | null;
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
    symbol_placement?: 'before' | 'after' | null;
    time_zone?: string | null;
    business_hours?: Record<string, unknown> | null;
    trailing_zero_handling?: 'show' | 'hide' | null;
    aggregation_format?: string | null;
    signature?: string | null;
    created_by?: string | null;
}

/** Fields that can be updated on a user */
export interface UpdateUserInput {
    password?: string;
    status?: 'active' | 'inactive' | 'deleted';
    first_name?: string | null;
    last_name?: string;
    title?: string | null;
    department?: string | null;
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
    symbol_placement?: 'before' | 'after' | null;
    time_zone?: string | null;
    business_hours?: Record<string, unknown> | null;
    trailing_zero_handling?: 'show' | 'hide' | null;
    aggregation_format?: string | null;
    signature?: string | null;
    updated_at?: Date;
    last_login_at?: Date | null;
    password_changed_at?: Date | null;
}

// ============================================================
// ROLES
// ============================================================

/** Required fields for creating a role (from 03_roles.js migration) */
export interface CreateRoleInput {
    name: string;
    code: string;
    // Optional fields
    description?: string | null;
    parent_role_id?: string | null;
    is_active?: boolean;
    created_by?: string | null;
}

/** Fields that can be updated on a role */
export interface UpdateRoleInput {
    name?: string;
    code?: string;
    description?: string | null;
    parent_role_id?: string | null;
    is_active?: boolean;
}

// ============================================================
// PROFILES
// ============================================================

/** Required fields for creating a profile (from 05_profiles.js migration) */
export interface CreateProfileInput {
    name: string;
    code: string;
    // Optional fields
    description?: string | null;
    is_active?: boolean;
    created_by?: string | null;
}

/** Fields that can be updated on a profile */
export interface UpdateProfileInput {
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
}

// ============================================================
// GROUPS
// ============================================================

/** Required fields for creating a group (from 10_groups.js migration) */
export interface CreateGroupInput {
    name: string;
    code: string;
    // Optional fields
    description?: string | null;
    is_active?: boolean;
    created_by?: string | null;
}

/** Fields that can be updated on a group */
export interface UpdateGroupInput {
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
}

// ============================================================
// MODULES
// ============================================================

/** Required fields for creating a module (from 07_modules.js migration) */
export interface CreateModuleInput {
    name: string;
    code: string;
    // Optional fields
    description?: string | null;
    is_active?: boolean;
}

/** Fields that can be updated on a module */
export interface UpdateModuleInput {
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
}

// ============================================================
// PERMISSIONS
// ============================================================

/** Required fields for creating a permission (from 08_permissions.js migration) */
export interface CreatePermissionInput {
    action: 'create' | 'read' | 'update' | 'delete' | 'export';
    module_id: string;
    // Optional fields
    description?: string | null;
}

/** Fields that can be updated on a permission */
export interface UpdatePermissionInput {
    action?: 'create' | 'read' | 'update' | 'delete' | 'export';
    description?: string | null;
}

// ============================================================
// SHARING RULES
// ============================================================

/** Required fields for creating a sharing rule (from 13_sharing_rules.js migration) */
export interface CreateSharingRuleInput {
    rule_type: 'public' | 'private';
    module_id: string;
    // Optional fields
    is_active?: boolean;
    created_by?: string | null;
}

/** Fields that can be updated on a sharing rule */
export interface UpdateSharingRuleInput {
    rule_type?: 'public' | 'private';
    is_active?: boolean;
}

// ============================================================
// SMTP CONFIG
// ============================================================

/** Required fields for creating SMTP config (from 14_smtp_config.js migration) */
export interface CreateSmtpConfigInput {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    encryption: 'none' | 'ssl' | 'tls';
    from_email: string;
    from_name: string;
    // Optional fields
    is_active?: boolean;
    reply_to_email?: string | null;
}

/** Fields that can be updated on SMTP config */
export interface UpdateSmtpConfigInput {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    encryption?: 'none' | 'ssl' | 'tls';
    from_email?: string;
    from_name?: string;
    is_active?: boolean;
    reply_to_email?: string | null;
}

// ============================================================
// AUDIT LOGS (append-only, no update)
// ============================================================

/** Required fields for creating an audit log entry (from 16_audit_logs.js migration) */
export interface CreateAuditLogInput {
    action: 'create' | 'update' | 'delete' | 'export';
    module_id: string;
    entity_type: string;
    entity_id: string;
    ip_address: string;
    user_agent: string;
    status: 'success' | 'failure';
    // Optional fields
    user_id?: string | null;
    role_id?: string | null;
    old_values?: Record<string, unknown> | null;
    new_values?: Record<string, unknown> | null;
}

// ============================================================
// OTP TOKENS (append-only, no update)
// ============================================================

/** Required fields for creating an OTP token (from 17_otp_tokens.js migration) */
export interface CreateOtpTokenInput {
    user_id: string;
    otp_hash: string;
    expires_at: Date;
    sent_to: string;
    ip_address: string;
    user_agent: string;
    // Optional fields
    attempt_count?: number;
}

// ============================================================
// ORGANIZATIONS
// ============================================================

/** Fields that can be updated on an organization (from 01_organizations.js migration) */
export interface UpdateOrganizationInput {
    company_name?: string;
    company_logo?: string;
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
    gstin?: string;
    is_active?: boolean;
}
