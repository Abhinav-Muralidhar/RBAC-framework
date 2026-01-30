/**
 * Module DTOs
 * 
 * Request, Response, and Filter DTOs for Modules.
 */

// ============================================================================
// REQUEST DTOs
// ============================================================================

export interface CreateModuleRequestDto {
    name: string;
    code: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
}

export interface UpdateModuleRequestDto {
    name?: string;
    code?: string;
    description?: string | null;
    is_active?: boolean;
    sort_order?: number;
}

// ============================================================================
// FILTER DTOs
// ============================================================================

export interface ModuleListFilterDto {
    is_active?: boolean;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export interface ModuleResponseDto {
    id: string;
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
}

export interface ModuleSummaryDto {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}
