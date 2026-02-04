/**
 * Profile Types
 */

export interface Profile {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    permissions?: Array<{
        id: string;
        module_id: string;
        module_code: string;
        module_name: string;
        action: string;
        effect: 'allow' | 'deny';
    }>;
    role_count?: number;

    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;
}

export interface CreateProfileDto {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
    permission_ids?: string[];
}

export interface UpdateProfileDto {
    name?: string;
    code?: string;
    description?: string;
    is_active?: boolean;
    permission_ids?: string[];
}

export interface ProfileSummaryDto {
    id: string;
    name: string;
    description?: string;
    code: string;
    is_active: boolean;
}