export type UserStatus = 'active' | 'inactive' | 'deleted';
export type SymbolPlacement = 'before' | 'after';
export type TrailingZeroHandling = 'show' | 'hide';

export interface Users {
  id: string;

  username: string;
  password: string;

  status: UserStatus;

  first_name?: string | null;
  last_name: string;
  title?: string | null;
  department?: string | null;

  reports_to_user_id?: string | null;

  primary_email: string;
  secondary_email?: string | null;
  other_email?: string | null;

  office_phone?: string | null;
  mobile_phone?: string | null;
  home_phone?: string | null;
  secondary_phone?: string | null;
  fax?: string | null;

  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;

  default_landing_page?: string | null;
  name_format?: string | null;
  phone_country_code?: string | null;
  full_screen_preview?: boolean | null;

  preferred_currency?: string | null;
  digit_grouping_pattern?: string | null;
  decimal_separator?: string | null;
  decimal_precision?: number | null;

  symbol_placement?: SymbolPlacement | null;
  trailing_zero_handling?: TrailingZeroHandling | null;

  time_zone?: string | null;
  business_hours?: Record<string, unknown> | null;

  aggregation_format?: string | null;
  signature?: string | null;

  created_at: Date;
  created_by?: string | null;

  updated_at?: Date | null;
  last_login_at?: Date | null;
  password_changed_at?: Date | null;
}
