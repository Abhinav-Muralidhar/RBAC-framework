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
        module_code: string;
        module_name: string;
        action: string;
        effect: 'allow' | 'deny';
    }>;
    created_at: string;
}

export interface CreateProfileDto {
    name: string;
    code: string;
    description?: string;
}

export interface UpdateProfileDto {
    name?: string;
    description?: string;
    is_active?: boolean;
}
