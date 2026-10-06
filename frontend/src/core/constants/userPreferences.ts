/**
 * User Preference Constants
 * 
 * Shared dropdown options for name format, time zones, currencies, etc.
 * Used by both UserForm (admin) and ProfilePage (self-service).
 */

// ============================================================================
// Name Format
// ============================================================================

export const NAME_FORMAT_OPTIONS = [
    { key: 'first_last', label: 'First Last' },
    { key: 'last_first', label: 'Last, First' },
] as const;

export type NameFormatKey = typeof NAME_FORMAT_OPTIONS[number]['key'];

/** Apply name format to a first/last name pair */
export function formatUserName(
    firstName: string | null | undefined,
    lastName: string,
    format: string | null | undefined
): string {
    const fn = firstName || '';
    const ln = lastName || '';
    if (format === 'last_first') {
        return fn ? `${ln}, ${fn}` : ln;
    }
    // Default: first_last
    return fn ? `${fn} ${ln}` : ln;
}

// ============================================================================
// Time Zones (common, no backend table)
// ============================================================================

export const TIME_ZONE_OPTIONS = [
    // Americas
    { key: 'America/New_York', label: '(UTC-05:00) Eastern Time' },
    { key: 'America/Chicago', label: '(UTC-06:00) Central Time' },
    { key: 'America/Denver', label: '(UTC-07:00) Mountain Time' },
    { key: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time' },
    { key: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
    { key: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
    { key: 'America/Sao_Paulo', label: '(UTC-03:00) Sao Paulo' },
    { key: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) Buenos Aires' },
    { key: 'America/Toronto', label: '(UTC-05:00) Toronto' },
    { key: 'America/Vancouver', label: '(UTC-08:00) Vancouver' },
    { key: 'America/Mexico_City', label: '(UTC-06:00) Mexico City' },
    // Europe
    { key: 'Europe/London', label: '(UTC+00:00) London' },
    { key: 'Europe/Paris', label: '(UTC+01:00) Paris / Berlin' },
    { key: 'Europe/Helsinki', label: '(UTC+02:00) Helsinki / Bucharest' },
    { key: 'Europe/Moscow', label: '(UTC+03:00) Moscow' },
    { key: 'Europe/Istanbul', label: '(UTC+03:00) Istanbul' },
    // Asia
    { key: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
    { key: 'Asia/Karachi', label: '(UTC+05:00) Karachi' },
    { key: 'Asia/Kolkata', label: '(UTC+05:30) India (IST)' },
    { key: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka' },
    { key: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok' },
    { key: 'Asia/Shanghai', label: '(UTC+08:00) China / Singapore' },
    { key: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
    { key: 'Asia/Seoul', label: '(UTC+09:00) Seoul' },
    // Oceania
    { key: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
    { key: 'Australia/Perth', label: '(UTC+08:00) Perth' },
    { key: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
    // Africa
    { key: 'Africa/Johannesburg', label: '(UTC+02:00) Johannesburg' },
    { key: 'Africa/Lagos', label: '(UTC+01:00) Lagos' },
    { key: 'Africa/Cairo', label: '(UTC+02:00) Cairo' },
] as const;

// ============================================================================
// Currencies (common, no backend table)
// ============================================================================

export const CURRENCY_OPTIONS = [
    { key: 'USD', label: 'USD - US Dollar (USD)' },
    { key: 'EUR', label: 'EUR - Euro (EUR)' },
    { key: 'GBP', label: 'GBP - British Pound (GBP)' },
    { key: 'INR', label: 'INR - Indian Rupee (INR)' },
    { key: 'JPY', label: 'JPY - Japanese Yen (JPY)' },
    { key: 'CNY', label: 'CNY - Chinese Yuan (CNY)' },
    { key: 'CAD', label: 'CAD - Canadian Dollar (CAD)' },
    { key: 'AUD', label: 'AUD - Australian Dollar (AUD)' },
    { key: 'CHF', label: 'CHF - Swiss Franc (CHF)' },
    { key: 'KRW', label: 'KRW - South Korean Won (KRW)' },
    { key: 'SGD', label: 'SGD - Singapore Dollar (SGD)' },
    { key: 'AED', label: 'AED - UAE Dirham (AED)' },
    { key: 'SAR', label: 'SAR - Saudi Riyal (SAR)' },
    { key: 'BRL', label: 'BRL - Brazilian Real (BRL)' },
    { key: 'MXN', label: 'MXN - Mexican Peso (MXN)' },
    { key: 'ZAR', label: 'ZAR - South African Rand (ZAR)' },
    { key: 'RUB', label: 'RUB - Russian Ruble (RUB)' },
    { key: 'TRY', label: 'TRY - Turkish Lira (TRY)' },
    { key: 'SEK', label: 'SEK - Swedish Krona (SEK)' },
    { key: 'NOK', label: 'NOK - Norwegian Krone (NOK)' },
    { key: 'NZD', label: 'NZD - New Zealand Dollar (NZD)' },
    { key: 'PKR', label: 'PKR - Pakistani Rupee (PKR)' },
    { key: 'BDT', label: 'BDT - Bangladeshi Taka (BDT)' },
    { key: 'NGN', label: 'NGN - Nigerian Naira (NGN)' },
    { key: 'EGP', label: 'EGP - Egyptian Pound (EGP)' },
] as const;

// ============================================================================
// Phone Country Codes (common set)
// ============================================================================

export const PHONE_COUNTRY_CODE_OPTIONS = [
    { key: '+1', label: '+1 (United States / Canada)' },
    { key: '+44', label: '+44 (United Kingdom)' },
    { key: '+61', label: '+61 (Australia)' },
    { key: '+64', label: '+64 (New Zealand)' },
    { key: '+49', label: '+49 (Germany)' },
    { key: '+33', label: '+33 (France)' },
    { key: '+39', label: '+39 (Italy)' },
    { key: '+34', label: '+34 (Spain)' },
    { key: '+81', label: '+81 (Japan)' },
    { key: '+82', label: '+82 (South Korea)' },
    { key: '+86', label: '+86 (China)' },
    { key: '+91', label: '+91 (India)' },
    { key: '+971', label: '+971 (UAE)' },
    { key: '+966', label: '+966 (Saudi Arabia)' },
    { key: '+55', label: '+55 (Brazil)' },
    { key: '+52', label: '+52 (Mexico)' },
    { key: '+27', label: '+27 (South Africa)' },
    { key: '+7', label: '+7 (Russia)' },
    { key: '+90', label: '+90 (Turkey)' },
    { key: '+46', label: '+46 (Sweden)' },
    { key: '+47', label: '+47 (Norway)' },
    { key: '+65', label: '+65 (Singapore)' },
    { key: '+92', label: '+92 (Pakistan)' },
    { key: '+880', label: '+880 (Bangladesh)' },
    { key: '+234', label: '+234 (Nigeria)' },
    { key: '+20', label: '+20 (Egypt)' },
] as const;

// ============================================================================
// Digit Grouping / Number Formats
// ============================================================================

export const DIGIT_GROUPING_OPTIONS = [
    { key: '123,456,789', label: '123,456,789 (3-3-3)' },
    { key: '12,34,56,789', label: '12,34,56,789 (Indian)' },
    { key: '123 456 789', label: '123 456 789 (space)' },
    { key: '123.456.789', label: '123.456.789 (dot)' },
] as const;

export const DECIMAL_SEPARATOR_OPTIONS = [
    { key: '.', label: '. (dot)' },
    { key: ',', label: ', (comma)' },
] as const;

export const DECIMAL_PRECISION_OPTIONS = [
    { key: '0', label: '0' },
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
] as const;

// ============================================================================
// Symbol Placement
// ============================================================================

export const SYMBOL_PLACEMENT_OPTIONS = [
    { key: 'before', label: 'Before (e.g. $100)' },
    { key: 'after', label: 'After (e.g. 100$)' },
] as const;

// ============================================================================
// Trailing Zero Handling
// ============================================================================

export const TRAILING_ZERO_OPTIONS = [
    { key: 'show', label: 'Show (e.g. 10.00)' },
    { key: 'hide', label: 'Hide (e.g. 10)' },
] as const;
