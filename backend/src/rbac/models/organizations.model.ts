export interface Organizations {
  id: bigint; // bigIncrements

  company_name: string;
  company_logo: string;

  address: string;
  city: string;
  state: string;

  postal_code: number; // integer, length = 6
  country: string;
  country_code: number;

  phone?: string; // nullable by default (no notNullable)
  fax?: string | null; // nullable + unique
  website?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  linkedin?: string | null;

  financial_year_start_month?: number | null; // checkBetween 1–12

  gstin: string; // notNullable + unique

  is_active: boolean; // default true

  created_at: Date;
  created_by?: bigint | null;

  updated_at?: Date | null;
}
