/**
 * RBAC API
 * 
 * API functions for Users, Roles, Profiles, Groups, Audit Logs, Sessions.
 */

import { apiClient, type PaginatedResponse, type ApiResponse } from './client';
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types';
import type { Role, CreateRoleDto, UpdateRoleDto, RoleNode } from '../types/role.types';
import type { Profile, CreateProfileDto, UpdateProfileDto, Permission } from '../types/profile.types';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../types/group.types';
import type { AuditLog } from '../types/audit.types';
import type { Session } from '../types/session.types';
import type { Organization, UpdateOrganizationDto } from '../types/organization.types';
import type { SharingRule, CreateSharingRuleDto, UpdateSharingRuleDto } from '../types/sharingrule.types';

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}

// Helper to cast response to expected type since interceptor unwraps it
// but typescript thinks it returns AxiosResponse
const get = async <T>(url: string, params?: any): Promise<T> => {
    return apiClient.get(url, { params }) as Promise<T>;
};
const post = async <T>(url: string, data?: any): Promise<T> => {
    return apiClient.post(url, data) as Promise<T>;
};
const patch = async <T>(url: string, data?: any): Promise<T> => {
    return apiClient.patch(url, data) as Promise<T>;
};
const del = async <T>(url: string): Promise<T> => {
    return apiClient.delete(url) as Promise<T>;
};


// ============================================================================
// Users
// ============================================================================

export const usersApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<User>>('/rbac/users', params);
    },

    getById: async (id: string): Promise<User> => {
        const response = await get<ApiResponse<User>>(`/rbac/users/${id}`);
        return response.data;
    },

    create: async (data: CreateUserDto): Promise<User> => {
        const response = await post<ApiResponse<User>>('/rbac/users', data);
        return response.data;
    },

    update: async (id: string, data: UpdateUserDto): Promise<User> => {
        const response = await patch<ApiResponse<User>>(`/rbac/users/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await del(`/rbac/users/${id}`);
    },
};

// ============================================================================
// Roles
// ============================================================================

export const rolesApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<Role>>('/rbac/roles', params);
    },

    getById: async (id: string): Promise<Role> => {
        const response = await get<ApiResponse<Role>>(`/rbac/roles/${id}`);
        return response.data;
    },

    getTree: async (): Promise<RoleNode[]> => {
        const response = await get<ApiResponse<RoleNode[]>>(`/rbac/roles/tree`);
        return response.data;
    },

    create: async (data: CreateRoleDto): Promise<Role> => {
        const response = await post<ApiResponse<Role>>('/rbac/roles', data);
        return response.data;
    },

    update: async (id: string, data: UpdateRoleDto): Promise<Role> => {
        const response = await patch<ApiResponse<Role>>(`/rbac/roles/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await del(`/rbac/roles/${id}`);
    },

    assignToUser: async (roleId: string, userId: string): Promise<void> => {
        await post(`/rbac/roles/${roleId}/assign/${userId}`);
    },

    revokeFromUser: async (roleId: string, userId: string): Promise<void> => {
        await del(`/rbac/roles/${roleId}/revoke/${userId}`);
    },
};

// ============================================================================
// Profiles
// ============================================================================

export const profilesApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<Profile>>('/rbac/profiles', params);
    },

    getById: async (id: string): Promise<Profile> => {
        const response = await get<ApiResponse<Profile>>(`/rbac/profiles/${id}`);
        return response.data;
    },

    create: async (data: CreateProfileDto): Promise<Profile> => {
        const response = await post<ApiResponse<Profile>>('/rbac/profiles', data);
        return response.data;
    },

    update: async (id: string, data: UpdateProfileDto): Promise<Profile> => {
        const response = await patch<ApiResponse<Profile>>(`/rbac/profiles/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await del(`/rbac/profiles/${id}`);
    },
};

// ============================================================================
// Groups
// ============================================================================

export const groupsApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<Group>>('/rbac/groups', params);
    },

    getById: async (id: string): Promise<Group> => {
        const response = await get<ApiResponse<Group>>(`/rbac/groups/${id}`);
        return response.data;
    },

    create: async (data: CreateGroupDto): Promise<Group> => {
        const response = await post<ApiResponse<Group>>('/rbac/groups', data);
        return response.data;
    },

    update: async (id: string, data: UpdateGroupDto): Promise<Group> => {
        const response = await patch<ApiResponse<Group>>(`/rbac/groups/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await del(`/rbac/groups/${id}`);
    },
};

// ============================================================================
// Audit Logs
// ============================================================================

export const auditLogsApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<AuditLog>>('/rbac/audit-logs', params);
    },

    getById: async (id: string): Promise<AuditLog> => {
        const response = await get<ApiResponse<AuditLog>>(`/rbac/audit-logs/${id}`);
        return response.data;
    },
};

// ============================================================================
// Sessions
// ============================================================================

export const sessionsApi = {
    getAll: async (params?: PaginationParams) => {
        return get<PaginatedResponse<Session>>('/rbac/sessions', params);
    },

    getByUser: async (userId: string) => {
        return get<PaginatedResponse<Session>>(`/rbac/sessions/user/${userId}`);
    },

    revoke: async (sessionId: string): Promise<void> => {
        await del(`/rbac/sessions/${sessionId}`);
    },

    revokeAllByUser: async (userId: string): Promise<void> => {
        await del(`/rbac/sessions/user/${userId}/all`);
    },
};

// ============================================================================
// SMTP Config
// ============================================================================

import type { SmtpConfig, CreateSmtpConfigDto, UpdateSmtpConfigDto } from '../types/smtp.types';

export const smtpApi = {
    list: async (params?: PaginationParams) => {
        return get<PaginatedResponse<SmtpConfig>>('/rbac/smtpconfig', params);
    },

    getById: async (id: string): Promise<SmtpConfig> => {
        const response = await get<ApiResponse<SmtpConfig>>(`/rbac/smtpconfig/${id}`);
        return response.data;
    },

    getActive: async (): Promise<SmtpConfig | null> => {
        try {
            const response = await get<ApiResponse<SmtpConfig>>('/rbac/smtpconfig/active');
            return response.data;
        } catch {
            return null;
        }
    },

    create: async (data: CreateSmtpConfigDto): Promise<SmtpConfig> => {
        const response = await post<ApiResponse<SmtpConfig>>('/rbac/smtpconfig', data);
        return response.data;
    },

    update: async (id: string, data: UpdateSmtpConfigDto): Promise<SmtpConfig> => {
        const response = await patch<ApiResponse<SmtpConfig>>(`/rbac/smtpconfig/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await del(`/rbac/smtpconfig/${id}`);
    },

    test: async (data: CreateSmtpConfigDto): Promise<void> => {
        await post(`/rbac/email/test`, data);
    },
    /*activate: async (id: string): Promise<void> => {
        await post(`/rbac/smtpconfig/${id}/activate`);
    },*/
};


// ============================================================================
// OTP Tokens
// ============================================================================
export const authApi = {
    /**
     * Triggers an OTP email to the user.
     * Backend should handle rate limiting (e.g. max 5 attempts).
     */
    sendOtp: async (email: string): Promise<void> => {
        // Adjust route based on your backend, e.g. '/auth/otp/send' or '/auth/challenge'
        await post('/public/otp/send', { email });
    },

    /**
     * Verifies the code entered by the user.
     * Throws an error if invalid.
     */
    verifyOtp: async (email: string, otp: string): Promise<void> => {
        // Adjust route based on your backend
        await post('/public/otp/verify', { email, otp });
    },

    /**
     * (Optional) If you want to handle the password update via Auth API 
     * instead of Users API for stricter security checks.
     */
    resetPassword: async (email: string, otp: string, newPassword: string): Promise<void> => {
        await post('/public/otp/password/reset', { email, otp, newPassword });
    }
};

// ============================================================================
// Organization
// ============================================================================

export const organizationApi = {
    /**
     * Get organization details 
     */
    get: async (): Promise<Organization> => {
        const response = await get<ApiResponse<Organization>>('/rbac/organizations');
        return response.data;
    },

    /**
     * Update organization details
     * (read/update only – no create/delete)
     */
    update: async (
        id: string,
        data: Partial<Organization>
    ): Promise<Organization> => {
        const response = await patch<ApiResponse<Organization>>(
            `/rbac/organizations/${id}`,
            data
        );
        return response.data;
    },
};

// ============================================================================
// Permissions (Metadata)
// ============================================================================

export const permissionsApi = {
    /**
     * Get all permissions for UI assignment
     * Returns module_id, module_code, module_name, action, description
     */
    list: async (): Promise<Permission[]> => {
        const response = await get<ApiResponse<Permission[]>>('/rbac/permissions');
        return response.data;
    },
};
// ============================================================================
// Sharing Rules
// ============================================================================

export const sharingRulesApi = {
    /**
     * List all sharing rules with optional pagination
     */
    list: async (params?: { page?: number; limit?: number; is_active?: boolean }) => {
        const response = await apiClient.get<PaginatedResponse<SharingRule>>('/rbac/sharing-rules', { params });
        return response.data;
    },

    /**
     * Get a single sharing rule by ID
     */
    getById: async (id: number | string): Promise<SharingRule> => {
        const response = await apiClient.get<ApiResponse<SharingRule>>(`/rbac/sharing-rules/${id}`);
        return response.data.data;
    },

    /**
     * Create a new sharing rule
     */
    create: async (data: CreateSharingRuleDto): Promise<SharingRule> => {
        const response = await apiClient.post<ApiResponse<SharingRule>>('/rbac/sharing-rules', data);
        return response.data.data;
    },

    /**
     * Update an existing sharing rule
     */
    update: async (id: number | string, data: UpdateSharingRuleDto): Promise<SharingRule> => {
        const response = await apiClient.patch<ApiResponse<SharingRule>>(`/rbac/sharing-rules/${id}`, data);
        return response.data.data;
    },

    /**
     * Delete a sharing rule
     */
    delete: async (id: number | string): Promise<void> => {
        await apiClient.delete(`/rbac/sharing-rules/${id}`);
    },
};
