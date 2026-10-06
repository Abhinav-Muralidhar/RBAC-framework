/**
 * Auth Context
 * 
 * Provides authentication state and functions throughout the app.
 * All permission checks are done server-side - this is just for UI optimization.
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import type { User } from '../types/user.types';
import { AuthContext, type Permission } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch current user on mount (uses session cookie)
    const refreshUser = useCallback(async () => {
        try {
            setIsLoading(true);
            // Try to get current user using session cookie
            const response = await authApi.getCurrentUser();
            const currentUser = response?.user ?? null;
            setUser(currentUser);

            // Extract permissions from user's roles/profiles (if available)
            // This is just for UI - server validates all requests
            const userPermissions: Permission[] = [];
            for (const module in response.permissions) {
                const actions = response.permissions[module];
                for (const action in actions) {
                    userPermissions.push({
                        module,
                        action,
                        effect: actions[action]
                    });
                }
            }


            setPermissions(userPermissions);

        } catch {
            // Not authenticated
            setUser(null);
            setPermissions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    const login = useCallback(async (username: string, password: string): Promise<User> => {
        await authApi.login({ username, password });
        await refreshUser();
        // Return the updated user so callers can read preferences (e.g. default_landing_page)
        // We need to re-fetch since refreshUser sets state async
        const response = await authApi.getCurrentUser();
        return response.user;
    }, [refreshUser]);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            setUser(null);
            setPermissions([]);
            await queryClient.cancelQueries();
            queryClient.clear();
        }
    }, [queryClient]);

    // UI helper only - server validates all requests
    const hasPermission = useCallback((module: string, action: string): boolean => {
        return permissions.some(
            p => p.module === module && p.action === action && p.effect === 'allow'
        );
    }, [permissions]);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                permissions,
                login,
                logout,
                refreshUser,
                hasPermission,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
