/**
 * Google Places Provider (New)
 * 
 * Strict Single Responsibility:
 * LeadPilot discovery request -> Google Places API -> Google response -> Normalized GoogleBusinessCandidate
 * 
 * Boundary Constraints:
 * - Does NOT rank businesses
 * - Does NOT filter/exclude 5-star businesses
 * - Does NOT discover social media
 * - Does NOT crawl websites
 * - Does NOT calculate lead scores
 * - Does NOT write directly to database
 * - Does NOT touch frontend state
 */

import {
  GoogleBusinessCandidate,
  GoogleBusinessDetails,
  ProviderStatus,
} from '@/types/canonical';

export interface GoogleDiscoveryRequest {
  query: string;
  city?: string;
  state: string;
  country?: string;
  countryCode?: 'IN' | 'US' | 'CA' | string;
  bbox?: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  limit?: number;
}

export class GooglePlacesProvider {
  readonly providerId = 'google_places';
  readonly name = 'Google Places API (New)';

  /**
   * FieldMask for Places API (New) Text Search
   * Includes essential discovery + real rating & reviewCount for ranking
   */
  private getFieldMask(): string {
    return (
      process.env.GOOGLE_PLACES_FIELD_MASK ||
      'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken'
    );
  }

  public isConfigured(): boolean {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    return Boolean(key && key.trim().length > 0 && process.env.GOOGLE_PLACES_ENABLED !== 'false');
  }

  public getStatus(): ProviderStatus {
    if (process.env.GOOGLE_PLACES_ENABLED === 'false') return 'NOT_AVAILABLE';
    if (!this.isConfigured()) return 'NOT_CONFIGURED';
    return 'SUCCESS';
  }

  /**
   * Discovers business candidates via Google Places API (New) Text Search.
   * Returns normalized GoogleBusinessCandidate objects.
   */
  public async searchBusinesses(
    request: GoogleDiscoveryRequest
  ): Promise<{ status: ProviderStatus; candidates: GoogleBusinessCandidate[]; error?: string }> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        candidates: [],
        error: 'GOOGLE_PLACES_NOT_CONFIGURED: Missing GOOGLE_PLACES_API_KEY.',
      };
    }

    const apiKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)!.trim();
    const resolvedArea = request.city ? `${request.city}, ${request.state}` : request.state;
    const country = request.country || (request.countryCode === 'US' ? 'United States' : request.countryCode === 'CA' ? 'Canada' : 'India');
    const textQuery = `${request.query} in ${resolvedArea}, ${country}`;

    const candidates: GoogleBusinessCandidate[] = [];
    const seenPlaceIds = new Set<string>();
    let nextPageToken: string | undefined = undefined;
    const maxPages = Math.min(Math.ceil((request.limit || 20) / 20), 3);
    let pagesFetched = 0;

    try {
      do {
        pagesFetched++;
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const payload: Record<string, any> = {
          textQuery,
          pageSize: 20,
        };

        if (request.countryCode) {
          payload.regionCode = request.countryCode.toLowerCase();
        }

        if (nextPageToken) {
          payload.pageToken = nextPageToken;
        }

        if (request.bbox) {
          payload.locationRestriction = {
            rectangle: {
              low: { latitude: request.bbox.south, longitude: request.bbox.west },
              high: { latitude: request.bbox.north, longitude: request.bbox.east },
            },
          };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': this.getFieldMask(),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const rawErr = await response.text();
          let msg = `HTTP ${response.status}`;
          try {
            const parsed = JSON.parse(rawErr);
            msg = parsed.error?.message || msg;
          } catch {}

          if (response.status === 429) {
            return { status: 'RATE_LIMITED', candidates, error: `Google Places Rate Limited: ${msg}` };
          }
          return { status: 'API_ERROR', candidates, error: `Google Places API Error: ${msg}` };
        }

        const data = await response.json();
        const places = data.places || [];

        for (const p of places) {
          if (!p.id || seenPlaceIds.has(p.id)) continue;
          seenPlaceIds.add(p.id);

          const candidate = this.normalizePlace(p, request);
          candidates.push(candidate);
        }

        nextPageToken = data.nextPageToken;

        // If another page is available, Google requires a brief activation delay
        if (nextPageToken && pagesFetched < maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else {
          break;
        }
      } while (nextPageToken && pagesFetched < maxPages && candidates.length < (request.limit || 60));

      return {
        status: 'SUCCESS',
        candidates,
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || (err.message && err.message.includes('timeout'));
      return {
        status: isTimeout ? 'NOT_AVAILABLE' : 'API_ERROR',
        candidates,
        error: err.message || 'Failed connecting to Google Places API',
      };
    }
  }

  /**
   * Fetches full Place Details including actual reviews and place attributes
   */
  public async getPlaceDetails(placeId: string): Promise<{ status: ProviderStatus; details?: GoogleBusinessDetails; error?: string }> {
    if (!this.isConfigured()) {
      return { status: 'NOT_CONFIGURED', error: 'Missing GOOGLE_PLACES_API_KEY' };
    }

    const apiKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)!.trim();
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const fieldMask = 'id,displayName,formattedAddress,location,types,primaryType,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,rating,userRatingCount,businessStatus,reviews';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { status: 'API_ERROR', error: `HTTP ${response.status} from Google Place Details` };
      }

      const p = await response.json();
      const candidate = this.normalizePlace(p, { state: '' });

      const reviews = Array.isArray(p.reviews)
        ? p.reviews.map((r: any) => ({
            authorName: r.authorAttribution?.displayName || 'Anonymous',
            rating: typeof r.rating === 'number' ? r.rating : 0,
            text: r.text?.text || r.originalText?.text || '',
            publishTime: r.publishTime ? new Date(r.publishTime) : undefined,
          }))
        : [];

      return {
        status: 'SUCCESS',
        details: {
          ...candidate,
          reviews,
        },
      };
    } catch (err: any) {
      return { status: 'API_ERROR', error: err.message || 'Place details request failed' };
    }
  }

  /**
   * Pure Normalizer: maps raw Google Place object to canonical GoogleBusinessCandidate
   */
  public normalizePlace(
    p: any,
    request?: { city?: string; state?: string; country?: string; countryCode?: string; query?: string }
  ): GoogleBusinessCandidate {
    const placeId = p.id || '';
    const name = p.displayName?.text || null;
    const address = p.formattedAddress || null;
    const types: string[] = Array.isArray(p.types) ? p.types : [];
    const category = p.primaryTypeDisplayName?.text || p.primaryType || (types.length > 0 ? types[0].replace(/_/g, ' ') : null);

    const lat = typeof p.location?.latitude === 'number' ? p.location.latitude : null;
    const lon = typeof p.location?.longitude === 'number' ? p.location.longitude : null;

    const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
    const internationalPhone = p.internationalPhoneNumber || null;
    const website = p.websiteUri || null;
    const googleMapsUrl = p.googleMapsUri || (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null);

    const rating = typeof p.rating === 'number' ? p.rating : null;
    const reviewCount = typeof p.userRatingCount === 'number' ? p.userRatingCount : null;
    const businessStatus = p.businessStatus || 'OPERATIONAL';

    const resolvedCountry =
      request?.country ||
      (request?.countryCode === 'US'
        ? 'United States'
        : request?.countryCode === 'CA'
        ? 'Canada'
        : 'India');
    const resolvedState = request?.state || 'Uttar Pradesh';

    return {
      externalId: `google_${placeId}`,
      source: 'google_places',
      placeId,
      name,
      category,
      categories: types,
      address,
      city: request?.city || null,
      state: resolvedState,
      country: resolvedCountry,
      postalCode: null,
      latitude: lat,
      longitude: lon,
      phone,
      internationalPhone,
      website,
      googleMapsUrl,
      businessStatus,
      rating,
      reviewCount,
      openingHours: p.currentOpeningHours || null,
      capturedAt: new Date(),
      rawPayload: p,
    };
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();
