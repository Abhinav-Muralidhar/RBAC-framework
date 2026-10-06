export type SharingRuleType = 'public' | 'private';

export type SharingRule = {
    id: number;
    version: number;
    rule_type: string;
    module_id: number;
    is_active: boolean;
    created_at: string;
    created_by: number;
    name: string;
    updated_at: string | null;
    updated_by: string | null;
    module_name: string | null;
    created_by_name: string | null;
    updated_by_name: string | null;
};

// For creating a new sharing rule
export interface CreateSharingRuleDto {
    rule_type: string;
    module_id: string;
    is_active: boolean;
    created_by: number;      // required for insert
}

// For updating an existing rule
export interface UpdateSharingRuleDto {
    version: number;
    rule_type?: string;      // optional
    module_id?: string;      // optional
    is_active?: boolean;     // optional
}
