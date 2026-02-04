export type SharingRuleType = 'public' | 'private';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateSharingRuleRequestDto {
    rule_type: SharingRuleType;
    module_id: string;
    is_active?: boolean;
}

export interface UpdateSharingRuleRequestDto {
    rule_type?: SharingRuleType;
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface SharingRuleResponseDto {
    id: string;
    rule_type: SharingRuleType;
    module_id: string;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
}

export interface SharingRuleSummaryDto {
    id: string;
    rule_type: SharingRuleType;
    module_id: string;
    is_active: boolean;
}
