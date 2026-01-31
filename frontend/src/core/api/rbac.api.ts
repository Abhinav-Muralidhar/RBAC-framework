/**
 * RBAC API
 * 
 * API functions for Users, Roles, Profiles, Groups, Audit Logs, Sessions.
 */

import { apiClient, type PaginatedResponse, type ApiResponse } from './client';
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types';
import type { Role, CreateRoleDto, UpdateRoleDto } from '../types/role.types';
import type { Profile, CreateProfileDto, UpdateProfileDto } from '../types/profile.types';
import type { Group, CreateGroupDto, UpdateGroupDto } from '../types/group.types';
import type { AuditLog } from '../types/audit.types';
import type { Session } from '../types/session.types';

export interface PaginationParams {
    page?: number;
    limit?: number;
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
    getCurrent: async (): Promise<Session> => {
        const response = await get<ApiResponse<Session>>('/rbac/sessions/current');
        return response.data;
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
