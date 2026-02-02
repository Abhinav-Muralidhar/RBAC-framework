/**
 * Auth API
 * 
 * Login, logout, and session management.
 */

import { apiClient } from './client';
import type { User } from '../types/user.types';

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    user: User;
    message: string;
}

export interface SessionResponse {
    id: string;
    user_id: string;
    login_at: string;
    expires_at: string;
}

export const authApi = {
    /**
     * Login - sets session cookie
     */
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        const response = await apiClient.post('/auth/login', credentials);
        return response.data;
    },

    /**
     * Logout - clears session cookie
     */
    logout: async (): Promise<void> => {
        await apiClient.post('/rbac/sessions/logout');
    },

    /**
     * Get current session info
     */
    getCurrentSession: async (): Promise<SessionResponse> => {
        const response = await apiClient.get('/rbac/sessions/current');
        return response.data;
    },

    /**
     * Get current user info
     */
    getCurrentUser: async (): Promise<User> => {
        const response = await apiClient.get('/auth/users/me');
        return response.data;
    },
};
