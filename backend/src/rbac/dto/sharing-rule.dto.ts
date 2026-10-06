/**
 * Sharing Rule DTOs
 * 
 * Request, Response, and Filter DTOs for Sharing Rules.
 */

import { SharingRuleType } from '../models/sharing_rules.model';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateSharingRuleRequestDto {
    rule_type: SharingRuleType;
    module_id: string;
    is_active?: boolean;
}

export interface UpdateSharingRuleRequestDto {
    version: number;
    rule_type?: SharingRuleType;
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface SharingRuleResponseDto {
    id: string;
    version: number;
    rule_type: SharingRuleType;
    module_id: string;
    is_active: boolean;
    created_at: Date;
    created_by: string | null;
    created_by_name: string | null;
    updated_at: Date | null;
    updated_by: string | null;
    updated_by_name: string | null;
    module_name: string | null;
}

export interface SharingRuleSummaryDto {
    id: string;
    rule_type: SharingRuleType;
    module_id: string;
    is_active: boolean;
}
