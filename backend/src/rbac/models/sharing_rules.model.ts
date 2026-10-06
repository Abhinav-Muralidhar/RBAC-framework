export type SharingRuleType = 'public' | 'private';

export interface SharingRules {
  id: string;
  version: number;

  rule_type: SharingRuleType;

  module_id: string;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
  updated_at?: Date | null;
  updated_by?: string | null;
}
