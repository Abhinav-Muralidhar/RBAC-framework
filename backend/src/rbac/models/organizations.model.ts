export interface Organizations {
  id: string; // bigIncrements
  version: number;

  company_name: string;
  company_logo: string;
  company_logo_file_id: string | null;

  address: string;
  city: string;
  state: string;

  postal_code: string; // integer, length = 6
  country: string;
  country_code: string;

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
  created_by?: string | null;

  updated_at?: Date | null;
  updated_by?: string | null;
}
