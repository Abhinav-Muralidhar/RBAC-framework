/**
 * Role Types
 */

export interface Role {
    id: string;
    name: string;
    code: string;
    description: string | null;
    parent_role_id: string | null;
    is_active: boolean;
    profiles?: Array<{ id: string; name: string; code: string }>;
    created_at: string;
    user_count?: number;
    child_role_count?: number;
    created_by: string | null;
    created_by_name: string | null;
}

export interface RoleSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}

export interface CreateRoleDto {
    name: string;
    code: string;
    description?: string;
    parent_role_id?: string;
    is_active?: boolean;
    profile_ids?: string[];
}

export interface UpdateRoleDto {
    name?: string;
    code?: string;
    description?: string | null;
    parent_role_id?: string | null;
    is_active?: boolean;
    profile_ids?: string[];
}

export interface RoleListFilterDto {
    is_active?: boolean;
    parent_role_id?: string;
}

export interface RoleSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}