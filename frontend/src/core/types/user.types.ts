/**
 * User Types
 */

export type UserStatus = 'active' | 'inactive' | 'deleted';

export interface User {
    id: string;
    username: string;
    status: UserStatus;
    first_name: string | null;
    last_name: string;
    title: string | null;
    department: string | null;
    primary_email: string;
    reports_to_user_id: string | null;
    reports_to_user_name: string | null;
    roles?: Array<{ id: string; name: string; code: string }>;
    groups?: Array<{ id: string; name: string }>;
    created_at: string;
    last_login_at: string | null;
}

export interface CreateUserDto {
    username: string;
    password: string;
    primary_email: string;
    last_name: string;
    first_name?: string;
    title?: string;
    department?: string;
}

export interface UpdateUserDto {
    username?: string;
    password?: string;
    status?: 'active' | 'inactive';
    first_name?: string;
    last_name?: string;
    title?: string;
    department?: string;
    primary_email?: string;
}
