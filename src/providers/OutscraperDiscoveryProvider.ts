import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { outscraperCircuitBreaker } from '@/lib/resilience/CircuitBreaker';
import { semaphores, getTimeoutConfig } from '@/lib/config/concurrencyConfig';
import { normalizePhone } from '@/utils/phoneUtils';
import { canonicalizeUrl } from '@/utils/urlUtils';

export class OutscraperDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'outscraper';
  readonly name = 'Outscraper Google Maps Engine';

  private static simulateTimeout: boolean = false;
  private static simulateQuotaExceeded: boolean = false;
  private static simulateAuthFailed: boolean = false;
  private static simulateResults: RawDiscoveredBusiness[] | null = null;

  public static setSimulateTimeout(simulate: boolean): void {
    OutscraperDiscoveryProvider.simulateTimeout = simulate;
  }

  public static setSimulateQuotaExceeded(simulate: boolean): void {
    OutscraperDiscoveryProvider.simulateQuotaExceeded = simulate;
  }

  public static setSimulateAuthFailed(simulate: boolean): void {
    OutscraperDiscoveryProvider.simulateAuthFailed = simulate;
  }

  public static setSimulateResults(results: RawDiscoveredBusiness[] | null): void {
    OutscraperDiscoveryProvider.simulateResults = results;
  }

  public static getSimulateResults(): RawDiscoveredBusiness[] | null {
    return OutscraperDiscoveryProvider.simulateResults;
  }

  public isConfigured(): boolean {
    const rawKey = process.env.OUTSCRAPER_API_KEY;
    const key = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '').trim() : '';
    const isEnabled = process.env.OUTSCRAPER_ENABLED !== 'false';
    return Boolean(key && key.length > 0 && isEnabled);
  }

  /**
   * Normalizes an individual place item from Outscraper into the canonical RawDiscoveredBusiness schema.
   * Completely decoupled from Outscraper-specific internal keys.
   */
  public mapOutscraperItemToBusiness(item: any, params: SearchDiscoveryParams): RawDiscoveredBusiness {
    const name = String(item.name || item.title || 'Unnamed Business').trim();
    const address = String(
      item.full_address || item.address || item.formatted_address || `${params.city || ''} ${params.state}`
    ).trim();

    const rawPhone = item.phone || item.phone_number || item.telephone;
    const phone = rawPhone ? normalizePhone(String(rawPhone)) : undefined;

    const rawWebsite = item.site || item.website || item.website_url;
    const website = rawWebsite ? canonicalizeUrl(String(rawWebsite)) : undefined;

    const placeId = item.place_id || item.google_id || item.id;
    const sourceId = placeId ? String(placeId) : `outscraper_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.abs(address.length)}`;

    const types: string[] = Array.isArray(item.subtypes)
      ? item.subtypes.map(String)
      : typeof item.type === 'string'
      ? [item.type]
      : [params.industry];

    const category = item.type || (types.length > 0 ? types[0] : params.industry);
    const rating = typeof item.rating === 'number' ? item.rating : null;
    const userRatingCount =
      typeof item.reviews === 'number'
        ? item.reviews
        : typeof item.reviews_data === 'number'
        ? item.reviews_data
        : null;

    const latitude =
      typeof item.latitude === 'number'
        ? item.latitude
        : item.latitude
        ? parseFloat(String(item.latitude))
        : undefined;

    const longitude =
      typeof item.longitude === 'number'
        ? item.longitude
        : item.longitude
        ? parseFloat(String(item.longitude))
        : undefined;

    const postalCode = item.postal_code || item.zip_code || item.postcode;

    const sourceUrl =
      item.location_link ||
      item.google_maps_url ||
      (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : undefined);

    const businessStatus = item.business_status || item.status || 'OPERATIONAL';

    return {
      source: 'outscraper',
      sources: ['outscraper'],
      sourceId,
      sourceUrl,
      confidence: 'HIGH',
      name,
      businessName: name,
      category,
      address,
      city: item.city || params.city,
      state: item.state || item.region || params.state,
      postalCode: postalCode ? String(postalCode) : undefined,
      postcode: postalCode ? String(postalCode) : undefined,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      phone,
      email: item.email || (Array.isArray(item.emails) && item.emails.length > 0 ? String(item.emails[0]) : undefined),
      website,
      types,
      googlePlaceId: placeId ? String(placeId) : undefined,
      rating,
      userRatingCount,
      businessStatus,
      rawTags: {
        outscraperPlaceId: placeId,
        googleId: item.google_id,
        types,
        rating,
        userRatingCount,
        reviewsCount: item.reviews,
      },
      sourceEvidence: [
        {
          source: 'outscraper',
          sourceId,
          sourceUrl,
          rawTags: {
            placeId,
            rating,
            userRatingCount,
          },
        },
      ],
    };
  }

  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const resolvedArea = params.city ? `${params.city}, ${params.state}` : params.state;
    const country = params.country || 'India';
    const cleanQuery = `${params.industry} in ${resolvedArea}, ${country}`;

    // 0. Simulation handling for automated integration testing
    if (OutscraperDiscoveryProvider.simulateTimeout) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'FAILED',
        statusReason: 'Outscraper API query timed out (Simulated).',
        pagesRequested: 1,
        errors: ['OUTSCRAPER_TIMEOUT'],
        durationMs: 3000,
      };
    }

    if (OutscraperDiscoveryProvider.simulateQuotaExceeded) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'RATE_LIMITED',
        statusReason: 'Outscraper API quota exceeded or credits depleted (Simulated).',
        pagesRequested: 1,
        errors: ['OUTSCRAPER_QUOTA_EXCEEDED'],
        durationMs: 150,
      };
    }

    if (OutscraperDiscoveryProvider.simulateAuthFailed) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'AUTH_FAILED',
        statusReason: 'Outscraper authentication failed (HTTP 401/403 Invalid API Key).',
        pagesRequested: 1,
        errors: ['OUTSCRAPER_AUTH_FAILED'],
        durationMs: 100,
      };
    }

    if (OutscraperDiscoveryProvider.simulateResults !== null) {
      const simList = OutscraperDiscoveryProvider.simulateResults;
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: simList.length,
        businesses: simList,
        sourceComplete: simList.length > 0,
        status: simList.length > 0 ? 'SUCCESS' : 'NO_RESULTS',
        statusReason: `Discovered ${simList.length} places via Outscraper Google Maps Engine (Simulated).`,
        pagesRequested: 1,
        errors: [],
        durationMs: 120,
      };
    }

    // 1. Configuration check
    const rawApiKey = process.env.OUTSCRAPER_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/^["']|["']$/g, '').trim() : '';
    const isEnabled = process.env.OUTSCRAPER_ENABLED !== 'false';

    if (!isEnabled) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'DISABLED',
        statusReason: 'Outscraper discovery is explicitly disabled via OUTSCRAPER_ENABLED=false.',
        pagesRequested: 0,
        errors: ['OUTSCRAPER_DISABLED'],
        durationMs: 0,
      };
    }

    if (!apiKey || apiKey.length === 0) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'NOT_CONFIGURED',
        statusReason: 'OUTSCRAPER_NOT_CONFIGURED: Missing OUTSCRAPER_API_KEY.',
        pagesRequested: 0,
        errors: ['OUTSCRAPER_NOT_CONFIGURED'],
        durationMs: 0,
      };
    }

    // 2. Concurrency limiting
    const releaseSemaphore = await semaphores.outscraper.acquire();
    const timeouts = getTimeoutConfig();
    const effectiveTimeoutMs = timeouts.outscraperFastMs || 15000;

    try {
      const targetLimit = Math.min(Math.max(params.limit || 20, 5), 100);

      // Map country name to 2-letter region code if applicable
      let regionCode: string | undefined = undefined;
      const lowerCountry = country.toLowerCase();
      if (lowerCountry.includes('india')) regionCode = 'IN';
      else if (lowerCountry.includes('united states') || lowerCountry.includes('usa') || lowerCountry === 'us') regionCode = 'US';
      else if (lowerCountry.includes('canada') || lowerCountry === 'ca') regionCode = 'CA';

      const url = new URL('https://api.outscraper.cloud/google-maps-search');
      url.searchParams.set('query', cleanQuery);
      url.searchParams.set('limit', String(targetLimit));
      url.searchParams.set('async', 'false');
      url.searchParams.set('language', 'en');
      if (regionCode) {
        url.searchParams.set('region', regionCode);
      }

      // 3. Resilient execution under Outscraper Circuit Breaker
      const discoveryResult = await outscraperCircuitBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

        try {
          const res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'X-API-KEY': apiKey,
              'Accept': 'application/json',
              'User-Agent': 'LeadPilot-Engine/2.1 (business-discovery-orchestrator)',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const status = res.status;
            let errorMsg = `HTTP ${status}`;
            try {
              const errBody = await res.json();
              if (errBody?.error || errBody?.message) {
                errorMsg = `${errorMsg}: ${errBody.error || errBody.message}`;
              }
            } catch {
              const raw = await res.text();
              errorMsg = `${errorMsg}: ${raw.slice(0, 150)}`;
            }

            // Sanitize: ensure API key never appears in error messages
            errorMsg = errorMsg.replace(new RegExp(apiKey, 'g'), '[REDACTED]');

            const error = new Error(errorMsg);
            (error as any).status = status;
            throw error;
          }

          const rawData = await res.json();
          return rawData;
        } finally {
          clearTimeout(timeoutId);
        }
      });

      // 4. Extract data items from Outscraper response
      // Outscraper returns: { id, status, data: [[ { place1 }, { place2 } ]] }
      let rawItems: any[] = [];
      if (Array.isArray(discoveryResult?.data)) {
        for (const batch of discoveryResult.data) {
          if (Array.isArray(batch)) {
            rawItems.push(...batch);
          } else if (batch && typeof batch === 'object') {
            rawItems.push(batch);
          }
        }
      } else if (Array.isArray(discoveryResult)) {
        rawItems = discoveryResult;
      }

      // 5. Normalize items into canonical RawDiscoveredBusiness schema
      const businesses: RawDiscoveredBusiness[] = [];
      const seenIds = new Set<string>();

      for (const item of rawItems) {
        if (!item || (!item.name && !item.title)) continue;
        const normalized = this.mapOutscraperItemToBusiness(item, params);
        if (seenIds.has(normalized.sourceId)) continue;
        seenIds.add(normalized.sourceId);
        businesses.push(normalized);
      }

      const durationMs = Date.now() - startTime;
      const status = businesses.length > 0 ? 'SUCCESS' : 'NO_RESULTS';
      const statusReason =
        businesses.length > 0
          ? `Discovered ${businesses.length} real businesses via Outscraper Google Maps Engine.`
          : `Outscraper queried successfully but returned zero results for ${params.industry} in ${resolvedArea}.`;

      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: businesses.length,
        businesses,
        sourceComplete: businesses.length > 0,
        status,
        statusReason,
        pagesRequested: 1,
        queryUsed: cleanQuery,
        endpointUsed: 'https://api.outscraper.cloud/google-maps-search',
        errors: [],
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = String(err.message || '');
      const isTimeout = err.name === 'AbortError' || errMsg.includes('timeout') || errMsg.includes('timed out');
      const isAuth =
        err.status === 401 ||
        err.status === 403 ||
        errMsg.includes('401') ||
        errMsg.includes('403') ||
        errMsg.includes('API key') ||
        errMsg.includes('Unauthorized');
      const isRate =
        err.status === 429 ||
        err.status === 402 ||
        errMsg.includes('429') ||
        errMsg.includes('402') ||
        errMsg.includes('quota') ||
        errMsg.includes('credits');

      const status: 'AUTH_FAILED' | 'RATE_LIMITED' | 'REQUEST_FAILED' | 'FAILED' = isAuth
        ? 'AUTH_FAILED'
        : isRate
        ? 'RATE_LIMITED'
        : 'REQUEST_FAILED';

      let reason = `Outscraper discovery query failed (${status}): ${errMsg}`;
      if (isAuth) {
        reason = `Outscraper authentication failed. Verify OUTSCRAPER_API_KEY in environment variables.`;
      } else if (isRate) {
        reason = `Outscraper credit limit reached or rate limited (HTTP 429/402).`;
      } else if (isTimeout) {
        reason = `Outscraper query timed out after ${effectiveTimeoutMs}ms.`;
      }

      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: resolvedArea,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status,
        statusReason: reason,
        pagesRequested: 1,
        errors: [errMsg],
        durationMs,
      };
    } finally {
      releaseSemaphore();
    }
  }
}

export const outscraperDiscoveryProvider = new OutscraperDiscoveryProvider();
