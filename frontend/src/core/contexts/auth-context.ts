import { createContext } from 'react';
import type { User } from '../types/user.types';

export interface Permission {
    module: string;
    action: string;
    effect: 'allow' | 'deny';
}

export interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    permissions: Permission[];
    login: (username: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    hasPermission: (module: string, action: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
