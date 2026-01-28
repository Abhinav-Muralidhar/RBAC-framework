export type SharingRuleType = 'public' | 'private';

export interface SharingRule {
  id: string;

  rule_type: SharingRuleType;

  module_id: string;

  is_active: boolean;

  created_at: Date;
  created_by?: string | null;
}
