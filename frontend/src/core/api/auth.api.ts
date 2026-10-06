/**
 * Auth API
 *
 * Login, logout, session, OTP, password reset, profile security.
 */

import { apiClient } from './client';
import type { GetCurrentUserResponse, User } from '../types/user.types';

/* =====================================================
   TYPES
===================================================== */

export interface LoginRequest {
    username: string;
    password: string;
}

export type LoginResponse = User;

export interface SessionResponse {
    id: string;
    user_id: string;
    login_at: string;
    expires_at: string;
}

/* =====================================================
   API
===================================================== */

export const authApi = {

    /* ---------------- AUTH ---------------- */

    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        const response = await apiClient.post('/auth/login', credentials);
        return response.data;
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/auth/logout');
    },

    getCurrentSession: async (): Promise<SessionResponse> => {
        const response = await apiClient.get('/rbac/sessions/current');
        return response.data;
    },

    getCurrentUser: async (): Promise<GetCurrentUserResponse> => {
        const response = await apiClient.get('/auth/users/me');
        return response.data;
    },

    /* ---------------- OTP ---------------- */

    sendOtp: async (email: string): Promise<void> => {
        await apiClient.post('/public/otp/send', { email });
    },

    verifyOtp: async (email: string, otp: string): Promise<void> => {
        await apiClient.post('/public/otp/verify', { email, otp });
    },

    resetPassword: async (
        email: string,
        otp: string,
        newPassword: string
    ): Promise<void> => {
        await apiClient.post('/public/otp/password/reset', {
            email,
            otp,
            newPassword,
        });
    },

    updateProfile: async (data: {
        first_name: string;
        last_name: string;
        avatar_url?: string;
    }): Promise<User> => {
        const response = await apiClient.patch('/auth/profile', data);
        return response.data;
    },

};
