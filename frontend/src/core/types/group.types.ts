/**
 * Group Types
 */

export interface Group {
    id: string;
    version: number;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    roles?: Array<{ id: string; name: string; code: string }>;
    users?: Array<{ id: string; name: string; code: string }>;
    user_count?: number;
    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;
}

export interface CreateGroupDto {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
    role_ids?: string[];
    user_ids?: string[];
}

export interface UpdateGroupDto {
    version: number;
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
    role_ids?: string[];
    user_ids?: string[];
}

export interface GroupListFilterDto {
    is_active?: boolean;
}

export interface GroupSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}

