/**
 * Central Route Configuration
 * 
 * Single source of truth for all route paths.
 * Use these constants instead of hardcoded strings.
 */

export const ROUTES = {
    // Auth routes
    LOGIN: '/login',

    // App routes
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    UNAUTHORIZED: '/unauthorized',

    // Settings (modal, not a route)
    SETTINGS: '/settings',

    // API paths (for reference/alignment with backend)
    API: {
        AUTH_LOGIN: '/auth/login',
        AUTH_LOGOUT: '/auth/logout',
        SESSIONS_CURRENT: '/rbac/sessions/current',
        SESSIONS_LOGOUT: '/rbac/sessions/logout',
    }
} as const;

// Settings sections for the modal
export const SETTINGS_SECTIONS = {
    ORGANIZATIONS: 'organizations',
    USERS: 'users',
    ROLES: 'roles',
    PROFILES: 'profiles',
    GROUPS: 'groups',
    SHARING_RULES: 'sharing-rules',
    SESSIONS: 'sessions',
    AUDIT_LOGS: 'audit-logs',
    SMTP: 'smtp',
} as const;

export type SettingsSection = typeof SETTINGS_SECTIONS[keyof typeof SETTINGS_SECTIONS];
