export type SharingRuleType = 'public' | 'private';

export interface SharingRule {
  id: bigint;

  rule_type: SharingRuleType;

  module_id: bigint;

  is_active: boolean;

  created_at: Date;
  created_by?: bigint | null;
}
