/**
 * API Client
 * 
 * Axios instance with interceptors for auth and error handling.
 * Cookies are sent automatically (withCredentials: true).
 */

import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Send cookies with every request
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor - unwrap { data, error, meta } envelope
apiClient.interceptors.response.use(
    (response) => {
        // Backend returns { data, error, meta } - extract data
        return response.data;
    },
    (error: AxiosError<{ error: { message: string; code: string } }>) => {
        // Handle 401 - redirect to login (unless already there)
        if (error.response?.status === 401) {
            // Don't redirect if already on login page to prevent loops
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // Extract error message from response
        const message = error.response?.data?.error?.message || error.message || 'An error occurred';
        return Promise.reject(new Error(message));
    }
);

// Type for API responses (after unwrapping)
export interface ApiResponse<T> {
    data: T;
    error: null;
    meta: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
    data: T[];
    error: null;
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
