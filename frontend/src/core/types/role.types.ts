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
}

export interface CreateRoleDto {
    name: string;
    code: string;
    description?: string;
    parent_role_id?: string;
}

export interface UpdateRoleDto {
    name?: string;
    description?: string;
    is_active?: boolean;
}
