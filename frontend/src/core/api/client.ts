/**
 * API Client
 *
 * Axios instance with interceptors for auth and error handling.
 * Cookies are sent automatically (withCredentials: true).
 */

import axios, { type AxiosError } from 'axios';
import { ApiError } from './errors';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_VERSION = 'v1';
const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '');
const API_BASE_URL_WITH_VERSION = normalizedBaseUrl.endsWith(`/${API_VERSION}`)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${API_VERSION}`;

export const apiClient = axios.create({
    baseURL: API_BASE_URL_WITH_VERSION,
    withCredentials: true, // Send cookies with every request
    headers: {
        'Content-Type': 'application/json',
    },
});

// ---------- Backend error envelope shape ----------
interface BackendErrorPayload {
    data: null;
    error: {
        message: string;
        code: string;
        details?: unknown;
    };
    meta?: {
        timestamp?: string;
        requestId?: string;
    };
}

// Response interceptor - unwrap { data, error, meta } envelope
apiClient.interceptors.response.use(
    (response) => {
        // Backend returns { data, error, meta } - extract the envelope
        return response.data;
    },
    (error: AxiosError<BackendErrorPayload>) => {
        const status = error.response?.status ?? 0;
        const payload = error.response?.data;

        const message =
            payload?.error?.message || error.message || 'An error occurred';
        const code = payload?.error?.code || 'UNKNOWN_ERROR';
        const details = payload?.error?.details;

        // Throw a structured ApiError — auth handling is done by AuthContext,
        // not by a hard window.location redirect.
        return Promise.reject(new ApiError(status, code, message, details));
    },
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
