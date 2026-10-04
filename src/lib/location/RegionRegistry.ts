/**
 * Region Registry
 * Canonical definitions and lookup for States, Provinces, and Territories across:
 * - United States (50 States + DC)
 * - Canada (10 Provinces + 3 Territories)
 * - India (28 States + 8 Union Territories)
 */

import { resolveCountry } from './CountryRegistry';
import { CANADIAN_PROVINCES_AND_TERRITORIES } from '@/data/canadaLocations';

export type RegionType = 'STATE' | 'PROVINCE' | 'TERRITORY' | 'DISTRICT';

export interface RegionInfo {
  code: string;
  name: string;
  countryCode: 'IN' | 'US' | 'CA';
  regionType: RegionType;
  primaryTimezone?: string;
  bounds?: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
}

// 1. ALL 50 US STATES + WASHINGTON D.C.
export const USA_REGIONS: RegionInfo[] = [
  { code: 'AL', name: 'Alabama', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'AK', name: 'Alaska', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Anchorage' },
  { code: 'AZ', name: 'Arizona', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Phoenix' },
  { code: 'AR', name: 'Arkansas', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'CA', name: 'California', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Los_Angeles', bounds: { south: 32.53, west: -124.48, north: 42.01, east: -114.13 } },
  { code: 'CO', name: 'Colorado', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Denver' },
  { code: 'CT', name: 'Connecticut', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'DE', name: 'Delaware', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'DC', name: 'District of Columbia', countryCode: 'US', regionType: 'TERRITORY', primaryTimezone: 'America/New_York' },
  { code: 'FL', name: 'Florida', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York', bounds: { south: 24.52, west: -87.63, north: 31.00, east: -80.03 } },
  { code: 'GA', name: 'Georgia', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'HI', name: 'Hawaii', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'Pacific/Honolulu' },
  { code: 'ID', name: 'Idaho', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Boise' },
  { code: 'IL', name: 'Illinois', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago', bounds: { south: 36.97, west: -91.51, north: 42.51, east: -87.50 } },
  { code: 'IN', name: 'Indiana', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Indiana/Indianapolis' },
  { code: 'IA', name: 'Iowa', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'KS', name: 'Kansas', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'KY', name: 'Kentucky', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'LA', name: 'Louisiana', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'ME', name: 'Maine', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'MD', name: 'Maryland', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'MA', name: 'Massachusetts', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'MI', name: 'Michigan', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Detroit' },
  { code: 'MN', name: 'Minnesota', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'MS', name: 'Mississippi', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'MO', name: 'Missouri', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago', bounds: { south: 35.99, west: -95.77, north: 40.61, east: -89.10 } },
  { code: 'MT', name: 'Montana', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Denver' },
  { code: 'NE', name: 'Nebraska', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'NV', name: 'Nevada', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Los_Angeles' },
  { code: 'NH', name: 'New Hampshire', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'NJ', name: 'New Jersey', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'NM', name: 'New Mexico', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Denver' },
  { code: 'NY', name: 'New York', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York', bounds: { south: 40.50, west: -79.76, north: 45.02, east: -71.86 } },
  { code: 'NC', name: 'North Carolina', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'ND', name: 'North Dakota', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'OH', name: 'Ohio', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'OK', name: 'Oklahoma', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'OR', name: 'Oregon', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Los_Angeles' },
  { code: 'PA', name: 'Pennsylvania', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'RI', name: 'Rhode Island', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'SC', name: 'South Carolina', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'SD', name: 'South Dakota', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'TN', name: 'Tennessee', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'TX', name: 'Texas', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago', bounds: { south: 25.84, west: -106.65, north: 36.50, east: -93.51 } },
  { code: 'UT', name: 'Utah', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Denver' },
  { code: 'VT', name: 'Vermont', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'VA', name: 'Virginia', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'WA', name: 'Washington', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Los_Angeles' },
  { code: 'WV', name: 'West Virginia', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/New_York' },
  { code: 'WI', name: 'Wisconsin', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Chicago' },
  { code: 'WY', name: 'Wyoming', countryCode: 'US', regionType: 'STATE', primaryTimezone: 'America/Denver' },
];

// 2. ALL 10 CANADIAN PROVINCES + 3 CANADIAN TERRITORIES
export const CANADA_REGIONS: RegionInfo[] = [
  // Provinces
  { code: 'AB', name: 'Alberta', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Edmonton' },
  { code: 'BC', name: 'British Columbia', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Vancouver' },
  { code: 'MB', name: 'Manitoba', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Winnipeg' },
  { code: 'NB', name: 'New Brunswick', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Moncton' },
  { code: 'NL', name: 'Newfoundland and Labrador', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/St_Johns' },
  { code: 'NS', name: 'Nova Scotia', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Halifax' },
  { code: 'ON', name: 'Ontario', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Toronto', bounds: { south: 41.68, west: -95.16, north: 56.86, east: -74.34 } },
  { code: 'PE', name: 'Prince Edward Island', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Halifax' },
  { code: 'QC', name: 'Quebec', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Montreal', bounds: { south: 44.99, west: -79.76, north: 62.58, east: -57.10 } },
  { code: 'SK', name: 'Saskatchewan', countryCode: 'CA', regionType: 'PROVINCE', primaryTimezone: 'America/Regina' },
  // Territories
  { code: 'NT', name: 'Northwest Territories', countryCode: 'CA', regionType: 'TERRITORY', primaryTimezone: 'America/Yellowknife' },
  { code: 'NU', name: 'Nunavut', countryCode: 'CA', regionType: 'TERRITORY', primaryTimezone: 'America/Iqaluit' },
  { code: 'YT', name: 'Yukon', countryCode: 'CA', regionType: 'TERRITORY', primaryTimezone: 'America/Whitehorse' },
];

// 3. ALL 36 INDIAN STATES & UNION TERRITORIES
export const INDIA_REGIONS: RegionInfo[] = [
  // States
  { code: 'AP', name: 'Andhra Pradesh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'AR', name: 'Arunachal Pradesh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'AS', name: 'Assam', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'BR', name: 'Bihar', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'CG', name: 'Chhattisgarh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'GA', name: 'Goa', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'GJ', name: 'Gujarat', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'HR', name: 'Haryana', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'HP', name: 'Himachal Pradesh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'JH', name: 'Jharkhand', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'KA', name: 'Karnataka', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'KL', name: 'Kerala', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'MP', name: 'Madhya Pradesh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'MH', name: 'Maharashtra', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'MN', name: 'Manipur', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'ML', name: 'Meghalaya', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'MZ', name: 'Mizoram', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'NL', name: 'Nagaland', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'OD', name: 'Odisha', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'PB', name: 'Punjab', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'RJ', name: 'Rajasthan', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'SK', name: 'Sikkim', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'TN', name: 'Tamil Nadu', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'TS', name: 'Telangana', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'TR', name: 'Tripura', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'UP', name: 'Uttar Pradesh', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata', bounds: { south: 23.85, west: 77.05, north: 30.40, east: 84.65 } },
  { code: 'UK', name: 'Uttarakhand', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  { code: 'WB', name: 'West Bengal', countryCode: 'IN', regionType: 'STATE', primaryTimezone: 'Asia/Kolkata' },
  // Union Territories
  { code: 'AN', name: 'Andaman and Nicobar Islands', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'CH', name: 'Chandigarh', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'DL', name: 'Delhi', countryCode: 'IN', regionType: 'DISTRICT', primaryTimezone: 'Asia/Kolkata' },
  { code: 'JK', name: 'Jammu and Kashmir', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'LA', name: 'Ladakh', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'LD', name: 'Lakshadweep', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
  { code: 'PY', name: 'Puducherry', countryCode: 'IN', regionType: 'TERRITORY', primaryTimezone: 'Asia/Kolkata' },
];

/**
 * Returns all regions for a specified country code ('US', 'CA', 'IN').
 */
export function getRegionsForCountry(countryCode: 'IN' | 'US' | 'CA' | string): RegionInfo[] {
  const norm = countryCode?.toUpperCase();
  if (norm === 'US') return USA_REGIONS;
  if (norm === 'CA') return CANADA_REGIONS;
  if (norm === 'IN') return INDIA_REGIONS;
  return [];
}

/**
 * Resolves a region string (name or abbreviation) within the context of a country.
 */
export function resolveRegion(countryCode: 'IN' | 'US' | 'CA' | string, regionInput?: string | null): RegionInfo | null {
  if (!regionInput || typeof regionInput !== 'string') return null;
  const regions = getRegionsForCountry(countryCode);
  const cleaned = regionInput.trim().toLowerCase();

  // 1. Direct match on code
  const byCode = regions.find((r) => r.code.toLowerCase() === cleaned);
  if (byCode) return byCode;

  // 2. Direct match on name
  const byName = regions.find((r) => r.name.toLowerCase() === cleaned);
  if (byName) return byName;

  // 3. Partial/Alias matching (e.g. "Washington DC", "N.Y.", "D.C.")
  if (countryCode === 'US') {
    if (cleaned === 'dc' || cleaned === 'd.c.' || cleaned === 'washington dc' || cleaned === 'washington, d.c.') {
      return regions.find((r) => r.code === 'DC') || null;
    }
  }

  return null;
}

export interface AdministrativeRegionValidationResult {
  valid: boolean;
  formatted: string;
  name?: string;
  code?: string;
  type?: RegionType;
  regionType?: RegionType;
  countryCode?: 'IN' | 'US' | 'CA';
  countryName?: string;
  bounds?: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  matchedCity?: string;
  error?: string;
  toString(): string;
  valueOf(): string;
}

/**
 * Validates administrative region (Province, State, Territory) across supported countries.
 * Example: validateAdministrativeRegion("CA", "Ontario") -> returns Ontario / ON / PROVINCE
 */
export function validateAdministrativeRegion(
  countryInput?: string | null,
  regionInput?: string | null,
  cityInput?: string | null
): AdministrativeRegionValidationResult {
  if (!countryInput || !countryInput.trim()) {
    const errorMsg = 'Country is required for administrative region validation.';
    return {
      valid: false,
      formatted: '',
      error: errorMsg,
      toString() { return errorMsg; },
      valueOf() { return errorMsg; }
    };
  }

  const country = resolveCountry(countryInput);
  if (!country) {
    const errorMsg = `Unsupported country: "${countryInput}". LeadPilot supports Canada (CA), United States (US), and India (IN).`;
    return {
      valid: false,
      formatted: '',
      error: errorMsg,
      toString() { return errorMsg; },
      valueOf() { return errorMsg; }
    };
  }

  if (!regionInput || !regionInput.trim()) {
    const errorMsg = `Administrative region (State / Province / Territory) is required for ${country.name}.`;
    return {
      valid: false,
      formatted: '',
      countryCode: country.code,
      countryName: country.name,
      error: errorMsg,
      toString() { return errorMsg; },
      valueOf() { return errorMsg; }
    };
  }

  const region = resolveRegion(country.code, regionInput);
  if (!region) {
    const errorMsg = `Invalid administrative region: "${regionInput}" for ${country.name} (${country.code}).`;
    return {
      valid: false,
      formatted: '',
      countryCode: country.code,
      countryName: country.name,
      error: errorMsg,
      toString() { return errorMsg; },
      valueOf() { return errorMsg; }
    };
  }

  // Canonical format requested by user: e.g. "Ontario / ON / PROVINCE"
  const formatted = `${region.name} / ${region.code} / ${region.regionType}`;

  let matchedCity: string | undefined = undefined;
  if (cityInput && cityInput.trim() && cityInput.toLowerCase() !== 'all cities in this state' && cityInput.toLowerCase() !== 'all cities in this province') {
    const cleanCity = cityInput.trim();
    if (country.code === 'CA') {
      const provData = CANADIAN_PROVINCES_AND_TERRITORIES.find(p => p.code === region.code);
      const cityMatch = provData?.cities.find(c => c.toLowerCase() === cleanCity.toLowerCase());
      matchedCity = cityMatch || cleanCity;
    } else {
      matchedCity = cleanCity;
    }
  }

  return {
    valid: true,
    formatted,
    name: region.name,
    code: region.code,
    type: region.regionType,
    regionType: region.regionType,
    countryCode: country.code,
    countryName: country.name,
    bounds: region.bounds,
    matchedCity,
    toString() {
      return formatted;
    },
    valueOf() {
      return formatted;
    }
  };
}
