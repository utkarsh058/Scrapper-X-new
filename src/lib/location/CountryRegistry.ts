/**
 * Country Registry
 * Canonical definitions and lookup for supported LeadPilot countries.
 * ISO 3166-1 alpha-2 codes.
 */

export interface CountryInfo {
  code: 'IN' | 'US' | 'CA';
  name: string;
  officialName: string;
  phonePrefix: string;
  currency: string;
  postalCodePattern: RegExp;
  postalCodeExample: string;
  timezones: string[];
  bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
}

export const SUPPORTED_COUNTRIES: Record<'IN' | 'US' | 'CA', CountryInfo> = {
  IN: {
    code: 'IN',
    name: 'India',
    officialName: 'Republic of India',
    phonePrefix: '+91',
    currency: 'INR',
    postalCodePattern: /^[1-9][0-9]{5}$/,
    postalCodeExample: '201310',
    timezones: ['Asia/Kolkata'],
    bounds: {
      south: 6.75,
      west: 68.15,
      north: 37.10,
      east: 97.40,
    },
  },
  US: {
    code: 'US',
    name: 'United States',
    officialName: 'United States of America',
    phonePrefix: '+1',
    currency: 'USD',
    postalCodePattern: /^\d{5}(-\d{4})?$/,
    postalCodeExample: '90001',
    timezones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
    ],
    bounds: {
      south: 24.396308,
      west: -125.0,
      north: 49.384358,
      east: -66.93457,
    },
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    officialName: 'Canada',
    phonePrefix: '+1',
    currency: 'CAD',
    postalCodePattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    postalCodeExample: 'M5V 2T6',
    timezones: [
      'America/St_Johns',
      'America/Halifax',
      'America/Toronto',
      'America/Winnipeg',
      'America/Edmonton',
      'America/Vancouver',
    ],
    bounds: {
      south: 41.676555,
      west: -141.00187,
      north: 83.110626,
      east: -52.619499,
    },
  },
};

/**
 * Resolves a country input string (e.g. "US", "USA", "United States", "CA", "Canada", "IN", "India")
 * to the canonical CountryInfo.
 */
export function resolveCountry(input?: string | null): CountryInfo | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();

  if (cleaned === 'in' || cleaned === 'ind' || cleaned === 'india') {
    return SUPPORTED_COUNTRIES.IN;
  }
  if (
    cleaned === 'us' ||
    cleaned === 'usa' ||
    cleaned === 'united states' ||
    cleaned === 'united states of america' ||
    cleaned === 'u.s.' ||
    cleaned === 'u.s.a.'
  ) {
    return SUPPORTED_COUNTRIES.US;
  }
  if (cleaned === 'ca' || cleaned === 'can' || cleaned === 'canada') {
    return SUPPORTED_COUNTRIES.CA;
  }

  return null;
}

export function isSupportedCountry(input?: string | null): boolean {
  return resolveCountry(input) !== null;
}

export function getAllSupportedCountries(): CountryInfo[] {
  return Object.values(SUPPORTED_COUNTRIES);
}
