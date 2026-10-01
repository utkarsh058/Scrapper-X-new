import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { googleUsageTracker } from '@/lib/billing/GoogleUsageTracker';
import { googlePlacesCircuitBreaker } from '@/lib/resilience/CircuitBreaker';
import { googleDiscoveryCache } from '@/lib/cache/GoogleDiscoveryCache';
import { semaphores, getTimeoutConfig } from '@/lib/config/concurrencyConfig';
import { executeWithRetry } from '@/lib/utils/retryUtils';

export class GooglePlacesDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'google_places';
  readonly name = 'Google Places API';

  /**
   * Configurable field mask: only discovery essentials.
   * Excluding expensive SKUs like photos, reviews, and atmosphere.
   */
  private getFieldMask(): string {
    return (
      process.env.GOOGLE_PLACES_FIELD_MASK ||
      'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,nextPageToken'
    );
  }

  public isConfigured(): boolean {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    return Boolean(key && key.trim().length > 0 && process.env.GOOGLE_PLACES_ENABLED !== 'false');
  }

  private static simulateTimeout: boolean = false;
  private static simulateQuotaExceeded: boolean = false;
  private static simulateResults: RawDiscoveredBusiness[] | null = null;

  public static setSimulateTimeout(simulate: boolean): void {
    GooglePlacesDiscoveryProvider.simulateTimeout = simulate;
  }

  public static setSimulateQuotaExceeded(simulate: boolean): void {
    GooglePlacesDiscoveryProvider.simulateQuotaExceeded = simulate;
  }

  public static setSimulateResults(results: RawDiscoveredBusiness[] | null): void {
    GooglePlacesDiscoveryProvider.simulateResults = results;
  }

  /**
   * Executes official Google Places Text Search (New) as the Primary Discovery Provider.
   * Supports multi-page pagination via nextPageToken up to targetPool limit.
   */
  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const resolvedArea = params.city ? `${params.city}, ${params.state}` : params.state;
    const country = params.country || 'India';
    const textQuery = `${params.industry} in ${resolvedArea}, ${country}`;

    if (GooglePlacesDiscoveryProvider.simulateTimeout) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_FAILURE',
        statusReason: 'Google Places API fast-path query timed out after 3000ms (Simulated).',
        errors: ['GOOGLE_TIMEOUT'],
        durationMs: 3000,
      };
    }

    if (GooglePlacesDiscoveryProvider.simulateQuotaExceeded) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_FAILURE',
        statusReason: 'Google Places API quota exceeded (Simulated).',
        errors: ['GOOGLE_QUOTA_EXCEEDED'],
        durationMs: 15,
      };
    }

    if (GooglePlacesDiscoveryProvider.simulateResults !== null) {
      const simList = GooglePlacesDiscoveryProvider.simulateResults;
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: simList.length,
        businesses: simList,
        sourceComplete: simList.length > 0,
        status: simList.length > 0 ? 'COMPLETE' : 'NO_RESULTS',
        statusReason: `Discovered ${simList.length} places via Google Places API (Simulated).`,
        errors: [],
        durationMs: 120,
      };
    }

    // 1. Configuration check (DO NOT silently swallow missing API key!)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const isEnabled = process.env.GOOGLE_PLACES_ENABLED !== 'false';

    if (!isEnabled) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        statusReason: 'Google Places discovery is disabled via GOOGLE_PLACES_ENABLED=false.',
        errors: ['GOOGLE_PLACES_DISABLED'],
        durationMs: 0,
      };
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        statusReason: 'GOOGLE_PLACES_NOT_CONFIGURED: Missing GOOGLE_PLACES_API_KEY.',
        errors: ['GOOGLE_PLACES_NOT_CONFIGURED'],
        durationMs: 0,
      };
    }

    // 2. Budget and Mode check
    const budgetCheck = googleUsageTracker.canExecuteGoogleRequest();
    if (!budgetCheck.allowed) {
      console.warn(`[GooglePlacesDiscoveryProvider] Blocked by budget policy: ${budgetCheck.reason}`);
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_FAILURE',
        statusReason: budgetCheck.reason || 'Google Places quota reached or blocked by budget policy.',
        errors: [budgetCheck.reason || 'QUOTA_EXCEEDED'],
        durationMs: Date.now() - startTime,
      };
    }

    const fieldMask = this.getFieldMask();
    const targetPool = Math.max((params.limit || 20) * 3, 60);
    const timeouts = getTimeoutConfig();
    const effectiveTimeout = Math.max(timeouts.googlePlacesFastMs || 3000, 3000);

    // 3. Concurrency Semaphore acquisition
    const releaseSemaphore = await semaphores.googlePlaces.acquire();

    try {
      const businesses: RawDiscoveredBusiness[] = [];
      const seenPlaceIds = new Set<string>();
      let nextPageToken: string | undefined = undefined;
      let pageCount = 0;
      const maxPages = 3; // Google Places Text Search (New) supports up to 3 pages (60 places)

      do {
        pageCount++;
        const currentPageToken: string | undefined = nextPageToken;

        const responseData = await googlePlacesCircuitBreaker.execute(async () => {
          return await executeWithRetry(
            async (signal) => {
              const url = 'https://places.googleapis.com/v1/places:searchText';
              const fetchStart = Date.now();

              const reqPayload: any = {
                textQuery,
                pageSize: 20,
              };
              if (currentPageToken) {
                reqPayload.pageToken = currentPageToken;
              }

              const res = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': fieldMask,
                },
                body: JSON.stringify(reqPayload),
                signal,
              });

              const durationMs = Date.now() - fetchStart;
              const contentType = res.headers.get('content-type') || '';
              const raw = await res.text();

              if (!res.ok) {
                googleUsageTracker.recordOperation({
                  operation: 'TEXT_SEARCH',
                  success: false,
                  statusCode: res.status,
                  durationMs,
                  query: textQuery,
                  error: `HTTP ${res.status}: ${raw.slice(0, 300)}`,
                });

                const errorObj: any = new Error(`Google Places API HTTP ${res.status}: ${raw.slice(0, 300)}`);
                errorObj.status = res.status;
                throw errorObj;
              }

              if (!contentType.includes('application/json')) {
                googleUsageTracker.recordOperation({
                  operation: 'TEXT_SEARCH',
                  success: false,
                  statusCode: res.status,
                  durationMs,
                  query: textQuery,
                  error: `Non-JSON response (${contentType})`,
                });
                throw new Error(`Google Places API returned non-JSON response (${contentType}): ${raw.slice(0, 300)}`);
              }

              let data: any;
              try {
                data = JSON.parse(raw);
              } catch (jsonErr: any) {
                googleUsageTracker.recordOperation({
                  operation: 'TEXT_SEARCH',
                  success: false,
                  statusCode: res.status,
                  durationMs,
                  query: textQuery,
                  error: 'Invalid JSON payload',
                });
                throw new Error(`Google Places API returned invalid JSON: ${raw.slice(0, 300)}`);
              }

              // Record successful billable operation
              googleUsageTracker.recordOperation({
                operation: 'TEXT_SEARCH',
                success: true,
                statusCode: res.status,
                durationMs,
                query: textQuery,
              });

              return data;
            },
            {
              maxRetries: 1,
              timeoutMs: effectiveTimeout,
            }
          );
        });

        const places = responseData.places || [];
        for (const p of places) {
          const placeId = p.id;
          if (!placeId || seenPlaceIds.has(placeId)) continue;
          seenPlaceIds.add(placeId);

          const name = p.displayName?.text || 'Unnamed Business';
          const address = p.formattedAddress || '';
          const phone = p.internationalPhoneNumber || p.nationalPhoneNumber;
          const website = p.websiteUri;
          const category = p.primaryType || params.industry;
          const lat = p.location?.latitude;
          const lon = p.location?.longitude;
          const rating = typeof p.rating === 'number' ? p.rating : undefined;
          const userRatingCount = typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined;

          // Cache place in PlaceCache
          googleDiscoveryCache.setPlace({
            placeId,
            name,
            address,
            location: lat && lon ? { latitude: lat, longitude: lon } : undefined,
            category,
            phone,
            websiteUrl: website,
            lastUpdated: new Date().toISOString(),
            source: 'google_places',
          });

          businesses.push({
            source: 'google_places',
            sources: ['google_places'],
            sourceId: placeId,
            sourceUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            confidence: 'high',
            name,
            businessName: name,
            category,
            address,
            city: params.city || params.state,
            state: params.state,
            latitude: lat,
            longitude: lon,
            phone,
            website,
            rawTags: {
              googlePlaceId: placeId,
              primaryType: p.primaryType,
              types: p.types,
              rating,
              userRatingCount,
            },
          });
        }

        nextPageToken = responseData.nextPageToken;
        if (nextPageToken && businesses.length < targetPool && pageCount < maxPages) {
          // Google Places API token requires slight propagation delay
          await new Promise((r) => setTimeout(r, 150));
        }
      } while (nextPageToken && businesses.length < targetPool && pageCount < maxPages);

      const durationMs = Date.now() - startTime;
      const rawCount = businesses.length;

      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount,
        businesses,
        sourceComplete: rawCount > 0,
        status: rawCount > 0 ? 'COMPLETE' : 'NO_RESULTS',
        statusReason:
          rawCount > 0
            ? `Google Places discovered ${rawCount} real businesses (${pageCount} page${pageCount > 1 ? 's' : ''}) in ${durationMs}ms.`
            : `Google Places searched successfully but found zero businesses for ${textQuery}.`,
        queryUsed: textQuery,
        endpointUsed: 'https://places.googleapis.com/v1/places:searchText',
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('timed out');
      console.warn(`[GooglePlacesDiscoveryProvider] Query failed: ${err.message}`);

      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'PROVIDER_FAILURE',
        statusReason: isTimeout
          ? `Google Places timed out after ${timeouts.googlePlacesFastMs}ms.`
          : `Google Places provider failure: ${err.message}`,
        errors: [err.message],
        durationMs,
      };
    } finally {
      releaseSemaphore();
    }
  }
}

export const googlePlacesDiscoveryProvider = new GooglePlacesDiscoveryProvider();
