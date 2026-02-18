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
    { key: 'America/Sao_Paulo', label: '(UTC-03:00) São Paulo' },
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
    { key: 'USD', label: 'USD — US Dollar ($)' },
    { key: 'EUR', label: 'EUR — Euro (€)' },
    { key: 'GBP', label: 'GBP — British Pound (£)' },
    { key: 'INR', label: 'INR — Indian Rupee (₹)' },
    { key: 'JPY', label: 'JPY — Japanese Yen (¥)' },
    { key: 'CNY', label: 'CNY — Chinese Yuan (¥)' },
    { key: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
    { key: 'AUD', label: 'AUD — Australian Dollar (A$)' },
    { key: 'CHF', label: 'CHF — Swiss Franc (Fr)' },
    { key: 'KRW', label: 'KRW — South Korean Won (₩)' },
    { key: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
    { key: 'AED', label: 'AED — UAE Dirham (د.إ)' },
    { key: 'SAR', label: 'SAR — Saudi Riyal (﷼)' },
    { key: 'BRL', label: 'BRL — Brazilian Real (R$)' },
    { key: 'MXN', label: 'MXN — Mexican Peso (MX$)' },
    { key: 'ZAR', label: 'ZAR — South African Rand (R)' },
    { key: 'RUB', label: 'RUB — Russian Ruble (₽)' },
    { key: 'TRY', label: 'TRY — Turkish Lira (₺)' },
    { key: 'SEK', label: 'SEK — Swedish Krona (kr)' },
    { key: 'NOK', label: 'NOK — Norwegian Krone (kr)' },
    { key: 'NZD', label: 'NZD — New Zealand Dollar (NZ$)' },
    { key: 'PKR', label: 'PKR — Pakistani Rupee (₨)' },
    { key: 'BDT', label: 'BDT — Bangladeshi Taka (৳)' },
    { key: 'NGN', label: 'NGN — Nigerian Naira (₦)' },
    { key: 'EGP', label: 'EGP — Egyptian Pound (E£)' },
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
