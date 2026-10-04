/**
 * Location Resolver Service
 * 
 * Strict Single Responsibility:
 * Authoritatively resolves and verifies geographical targets across:
 * - India (IN)
 * - United States (US)
 * - Canada (CA)
 * 
 * Enforces:
 * - Canonical country & state/province resolution
 * - Cross-country boundary verification (e.g. Los Angeles CA vs Los Angeles Chile)
 * - Authoritative Nominatim/Geocoding query with countrycodes filter
 * - Provenance tracking (locationSource, locationSourceName)
 * - Zero invented coordinates (missing coordinates remain NULL)
 */

import { resolveCountry, CountryInfo } from './CountryRegistry';
import { resolveRegion, RegionInfo } from './RegionRegistry';

export interface LocationResolutionInput {
  country: string;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export interface ResolvedLocation {
  countryCode: 'IN' | 'US' | 'CA';
  countryName: string;
  regionCode: string | null;
  regionName: string | null;
  regionType: 'STATE' | 'PROVINCE' | 'TERRITORY' | 'DISTRICT' | null;
  cityName: string | null;
  postalCode: string | null;
  resolvedQuery: string;
  latitude: number | null;
  longitude: number | null;
  bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  } | null;
  timezone: string | null;
  locationSource: 'OFFICIAL' | 'GEOCODED' | 'NOT_AVAILABLE';
  locationSourceName: string;
  isAmbiguous: boolean;
  isResolved: boolean;
}

export class LocationResolverService {
  private cache = new Map<string, ResolvedLocation>();

  /**
   * Resolves an input location strictly within country boundaries.
   */
  public async resolve(input: LocationResolutionInput): Promise<ResolvedLocation> {
    const country = resolveCountry(input.country);
    if (!country) {
      throw new Error(`Unsupported or invalid country: "${input.country}". Supported: India (IN), United States (US), Canada (CA).`);
    }

    const region = input.state ? resolveRegion(country.code, input.state) : null;
    const cleanCity = input.city?.trim() || null;
    const cleanPostal = input.postalCode?.trim() || null;

    // Cache key
    const cacheKey = `${country.code}:${region?.code || ''}:${cleanCity || ''}:${cleanPostal || ''}`.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Build the resolved hierarchical query string
    const parts: string[] = [];
    if (cleanCity) parts.push(cleanCity);
    if (cleanPostal) parts.push(cleanPostal);
    if (region) parts.push(region.name);
    parts.push(country.name);
    const resolvedQuery = parts.join(', ');

    // Baseline resolved object
    const result: ResolvedLocation = {
      countryCode: country.code,
      countryName: country.name,
      regionCode: region ? region.code : null,
      regionName: region ? region.name : null,
      regionType: region ? region.regionType : null,
      cityName: cleanCity,
      postalCode: cleanPostal,
      resolvedQuery,
      latitude: null,
      longitude: null,
      bounds: region?.bounds || country.bounds,
      timezone: region?.primaryTimezone || country.timezones[0] || null,
      locationSource: 'OFFICIAL',
      locationSourceName: 'LeadPilot Canonical Geography Registry',
      isAmbiguous: false,
      isResolved: true,
    };

    // If city or postalCode specified, attempt authoritative geocoding lookup
    if (cleanCity || cleanPostal) {
      try {
        const geocoded = await this.geocodeWithCountryFilter(
          country,
          region,
          cleanCity,
          cleanPostal
        );

        if (geocoded) {
          result.latitude = geocoded.lat;
          result.longitude = geocoded.lon;
          result.bounds = geocoded.bounds;
          result.locationSource = 'GEOCODED';
          result.locationSourceName = 'OpenStreetMap Nominatim Authoritative Geocoding';
          if (geocoded.cityName && !result.cityName) {
            result.cityName = geocoded.cityName;
          }
        }
      } catch (err: any) {
        // Geocoding network or rate limits: gracefully fallback without invented coordinates
        result.locationSource = 'NOT_AVAILABLE';
        result.locationSourceName = `Geocoding fallback (${err.message || 'offline'})`;
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Queries authoritative Nominatim geocoding restricted strictly by ISO country code.
   */
  private async geocodeWithCountryFilter(
    country: CountryInfo,
    region: RegionInfo | null,
    city: string | null,
    postalCode: string | null
  ): Promise<{
    lat: number;
    lon: number;
    bounds: { south: number; west: number; north: number; east: number };
    cityName?: string;
  } | null> {
    const qParts: string[] = [];
    if (city) qParts.push(city);
    if (postalCode) qParts.push(postalCode);
    if (region) qParts.push(region.name);

    const q = qParts.join(', ');
    const params = new URLSearchParams({
      q,
      format: 'json',
      countrycodes: country.code.toLowerCase(),
      limit: '1',
      addressdetails: '1',
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'LeadPilot-LocationResolver/2.0 (+https://leadpilot.app)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) return null;

      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const item = data[0];
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      if (isNaN(lat) || isNaN(lon)) return null;

      // Verification: ensure the coordinates are inside country bounds
      if (
        lat < country.bounds.south ||
        lat > country.bounds.north ||
        lon < country.bounds.west ||
        lon > country.bounds.east
      ) {
        // Geocoded location fell outside country boundary! Reject.
        return null;
      }

      // Verification: if region has bounds, check that coordinates fall within region
      if (region && region.bounds) {
        if (
          lat < region.bounds.south - 0.5 ||
          lat > region.bounds.north + 0.5 ||
          lon < region.bounds.west - 0.5 ||
          lon > region.bounds.east + 0.5
        ) {
          // Geocoded location fell outside region bounds!
          return null;
        }
      }

      const bbox = item.boundingbox;
      let bounds = {
        south: lat - 0.1,
        west: lon - 0.1,
        north: lat + 0.1,
        east: lon + 0.1,
      };

      if (Array.isArray(bbox) && bbox.length === 4) {
        bounds = {
          south: parseFloat(bbox[0]),
          north: parseFloat(bbox[1]),
          west: parseFloat(bbox[2]),
          east: parseFloat(bbox[3]),
        };
      }

      const extractedCity =
        item.address?.city ||
        item.address?.town ||
        item.address?.municipality ||
        item.address?.village ||
        city;

      return {
        lat,
        lon,
        bounds,
        cityName: extractedCity,
      };
    } catch {
      return null;
    }
  }

  /**
   * Synchronously disambiguates between multiple potential locations.
   */
  public disambiguateCity(cityName: string, targetCountry: string, targetState?: string): string {
    const country = resolveCountry(targetCountry);
    const countryName = country?.name || targetCountry;
    if (targetState) {
      const region = country ? resolveRegion(country.code, targetState) : null;
      const regName = region?.name || targetState;
      return `${cityName}, ${regName}, ${countryName}`;
    }
    return `${cityName}, ${countryName}`;
  }
}

export const locationResolverService = new LocationResolverService();
