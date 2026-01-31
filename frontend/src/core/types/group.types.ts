/**
 * Group Types
 */

export interface Group {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    roles?: Array<{ id: string; name: string; code: string }>;
    user_count?: number;
    created_at: string;
}

export interface CreateGroupDto {
    name: string;
    code: string;
    description?: string;
}

export interface UpdateGroupDto {
    name?: string;
    description?: string;
    is_active?: boolean;
}
