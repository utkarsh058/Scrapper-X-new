import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { leadPilotDb } from '@/db';

export class SecondaryBusinessDataProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'business_provider';
  readonly name = process.env.BUSINESS_DATA_PROVIDER_NAME || 'Secondary Business Data Provider';

  // Configurable failure simulation hook for automated test suites
  private static simulateFailureMode = false;

  public static setSimulateFailure(value: boolean) {
    SecondaryBusinessDataProvider.simulateFailureMode = value;
  }

  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();

    // Check simulated failure for testing
    if (SecondaryBusinessDataProvider.simulateFailureMode) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: params.city ? `${params.city}, ${params.state}` : params.state,
        rawCount: 0,
        businesses: [],
        sourceComplete: false,
        status: 'FAILED',
        statusReason: 'Simulated business provider upstream connection failure (HTTP 503 Service Unavailable)',
        errors: ['Simulated upstream HTTP 503 error for test verification.'],
        durationMs: Date.now() - startTime,
      };
    }

    const isEnabled = process.env.BUSINESS_DATA_PROVIDER_ENABLED === 'true';
    const apiKey = process.env.BUSINESS_DATA_PROVIDER_API_KEY;
    const baseUrl = process.env.BUSINESS_DATA_PROVIDER_BASE_URL;

    // Graceful disablement when not configured or credentials missing
    if (!isEnabled || !apiKey || !baseUrl) {
      return {
        providerId: this.providerId,
        providerName: this.name,
        resolvedAreaName: params.city ? `${params.city}, ${params.state}` : params.state,
        rawCount: 0,
        businesses: [],
        sourceComplete: true,
        status: 'DISABLED',
        statusReason: !isEnabled
          ? 'Secondary business data provider is disabled in environment configuration.'
          : 'Secondary business data provider requires valid API credentials.',
        errors: [],
        durationMs: 0,
      };
    }

    const cacheKey = `business_data_provider:${params.industry}:${params.state}:${params.city || 'all'}:${params.limit}`;
    const cached = leadPilotDb.getCache<DiscoveryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Call configured endpoint with retry and backoff
    let attempts = 0;
    const maxAttempts = 2;
    let lastError = 'Unknown error';

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const queryUrl = new URL(baseUrl);
        queryUrl.searchParams.set('query', `${params.industry} in ${params.city || ''} ${params.state}`.trim());
        queryUrl.searchParams.set('industry', params.industry);
        if (params.city) queryUrl.searchParams.set('city', params.city);
        queryUrl.searchParams.set('state', params.state);
        queryUrl.searchParams.set('limit', String(params.limit || 50));

        const res = await fetch(queryUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-KEY': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'LeadPilot-Engine/2.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          lastError = `API returned HTTP ${res.status}: ${res.statusText}`;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempts));
            continue;
          }
          break;
        }

        const json = await res.json();
        const rawItems = Array.isArray(json) ? json : json.data || json.results || json.businesses || [];

        const businesses: RawDiscoveredBusiness[] = rawItems.map((item: any, idx: number) => {
          const name = item.name || item.businessName || item.title || '';
          const postalCode = item.postalCode || item.postcode || item.zipCode;
          return {
            source: 'business_provider',
            sources: ['business_provider'],
            sourceId: String(item.id || item.place_id || `bp_${idx}_${Date.now()}`),
            sourceUrl: item.sourceUrl || item.url,
            confidence: 'verified_commercial_record',
            name,
            businessName: name,
            category: item.category || params.industry,
            address: item.address || item.formatted_address || `${params.city || ''} ${params.state}`.trim(),
            city: item.city || params.city,
            state: item.state || params.state,
            postalCode,
            postcode: postalCode,
            latitude: item.latitude || item.lat || item.geometry?.location?.lat,
            longitude: item.longitude || item.lng || item.geometry?.location?.lng,
            phone: item.phone || item.formatted_phone_number,
            email: item.email,
            website: item.website || item.websiteUrl,
            socialLinks: item.socialLinks,
            rawTags: item,
          };
        });

        const result: DiscoveryResult = {
          providerId: this.providerId,
          providerName: this.name,
          resolvedAreaName: params.city ? `${params.city}, ${params.state}` : params.state,
          rawCount: businesses.length,
          businesses,
          sourceComplete: true,
          status: businesses.length > 0 ? 'COMPLETE' : 'NO_RESULTS',
          statusReason: `Discovered ${businesses.length} candidates from ${this.name}.`,
          durationMs: Date.now() - startTime,
        };

        leadPilotDb.setCache(cacheKey, result, 3600000);
        return result;
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err.message || 'Request timed out';
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * attempts));
        }
      }
    }

    return {
      providerId: this.providerId,
      providerName: this.name,
      resolvedAreaName: params.city ? `${params.city}, ${params.state}` : params.state,
      rawCount: 0,
      businesses: [],
      sourceComplete: false,
      status: 'FAILED',
      statusReason: `Business provider query failed: ${lastError}`,
      errors: [lastError],
      durationMs: Date.now() - startTime,
    };
  }
}

export const secondaryBusinessDataProvider = new SecondaryBusinessDataProvider();
