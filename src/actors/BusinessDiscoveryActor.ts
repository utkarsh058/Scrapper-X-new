import { BaseActor, ActorContext } from '@/models/Actor';
import { RawDiscoveredBusiness, SearchDiscoveryParams } from '@/providers/BusinessDiscoveryProvider';
import { googleDiscoveryCache } from '@/lib/cache/GoogleDiscoveryCache';
import { providerManager } from '@/lib/providers/ProviderManager';

export interface ProviderStat {
  rawCount: number;
  discovered?: number;
  pagesRequested?: number;
  status:
    | 'COMPLETE'
    | 'PARTIAL'
    | 'FAILED'
    | 'DISABLED'
    | 'NO_RESULTS'
    | 'NOT_NEEDED'
    | 'SUCCESS'
    | 'PROVIDER_NOT_CONFIGURED'
    | 'PROVIDER_FAILURE';
  durationMs: number;
  reason?: string;
  errors?: string[];
}

export interface BusinessDiscoveryOutput {
  businesses: RawDiscoveredBusiness[];
  rawCount: number;
  sourceComplete: boolean;
  statusReason?: string;
  sourceStatus?: 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'NO_RESULTS' | 'PROVIDER_FAILURE' | 'PROVIDER_NOT_CONFIGURED';
  queryUsed?: string;
  endpointUsed?: string;
  providerStats: {
    osm: ProviderStat;
    googlePlaces?: ProviderStat;
    web: ProviderStat;
    webSearch: ProviderStat;
    businessProvider: ProviderStat;
    directory: ProviderStat;
  };
  totalDiscovered: number;
  googleLatencyMs?: number;
  osmLatencyMs?: number;
  cacheHit?: boolean;
}

export class BusinessDiscoveryActor extends BaseActor<SearchDiscoveryParams, BusinessDiscoveryOutput> {
  readonly actorId = 'actor_business_discovery';
  readonly name = 'Primary Google Places & OSM Discovery Actor';
  readonly priority = 'HIGH' as const;
  readonly blocking = true;
  readonly timeoutMs = 15000;
  readonly dependencies = [];
  readonly estimatedCost = 1;

  protected async run(context: ActorContext<SearchDiscoveryParams>): Promise<{
    data: BusinessDiscoveryOutput;
    sources: string[];
    warnings?: string[];
  }> {
    const params = context.input;
    const loc = params.city ? `${params.city}, ${params.state}` : params.state;
    context.onProgress?.(`Initiating business discovery (Google Places Primary + OSM Fallback) for ${params.industry} in ${loc}...`);

    const requestedLimit = Math.max(Number(params.limit) || 25, 5);

    // 1. Caching & In-flight Request Deduplication via GoogleDiscoveryCache
    const searchKey = googleDiscoveryCache.generateSearchKey({
      industry: params.industry,
      state: params.state,
      city: params.city,
      country: params.country,
      limit: requestedLimit,
    });

    const cached = googleDiscoveryCache.getSearchQueryResults<BusinessDiscoveryOutput>(searchKey);
    if (cached && cached.rawCount > 0) {
      context.onProgress?.(
        `Retrieved ${cached.rawCount} businesses immediately from query cache (TTL active).`,
        cached.rawCount
      );
      return {
        data: {
          ...cached,
          cacheHit: true,
        },
        sources: ['Google Discovery Cache'],
        warnings: ['Served from 24-hour query cache.'],
      };
    }

    // 2. Delegate to ProviderManager for orchestrated primary Google Places + fallback OSM
    const managerResult = await providerManager.executeDiscovery(params, context.onProgress);

    const activeSources: string[] = [];
    if (managerResult.providers.googlePlaces.rawCount > 0) activeSources.push('Google Places API');
    if (managerResult.providers.osm.rawCount > 0) activeSources.push('OpenStreetMap');
    if (activeSources.length === 0) {
      activeSources.push(managerResult.primaryProvider === 'google_places' ? 'Google Places API' : 'OpenStreetMap');
    }

    const dummyStat = (status: 'DISABLED' | 'NOT_NEEDED'): ProviderStat => ({
      rawCount: 0,
      discovered: 0,
      status,
      durationMs: 0,
      errors: [],
    });

    const gStat: ProviderStat = {
      rawCount: managerResult.providers.googlePlaces.rawCount,
      discovered: managerResult.providers.googlePlaces.rawCount,
      pagesRequested: managerResult.providers.googlePlaces.pagesRequested,
      status: managerResult.providers.googlePlaces.status as any,
      durationMs: managerResult.latencies.googleMs,
      reason: managerResult.providers.googlePlaces.reason,
      errors: managerResult.providers.googlePlaces.errors,
    };

    const oStat: ProviderStat = {
      rawCount: managerResult.providers.osm.rawCount,
      discovered: managerResult.providers.osm.rawCount,
      status: managerResult.providers.osm.status as any,
      durationMs: managerResult.latencies.osmMs,
      reason: managerResult.providers.osm.reason,
      errors: managerResult.providers.osm.errors,
    };

    const wStat: ProviderStat = {
      rawCount: managerResult.providers.webSearch?.rawCount || 0,
      discovered: managerResult.providers.webSearch?.rawCount || 0,
      status: (managerResult.providers.webSearch?.status || 'NOT_NEEDED') as any,
      durationMs: managerResult.latencies.webMs || 0,
      reason: managerResult.providers.webSearch?.reason,
      errors: managerResult.providers.webSearch?.errors,
    };

    const dStat: ProviderStat = {
      rawCount: managerResult.providers.directory?.rawCount || 0,
      discovered: managerResult.providers.directory?.rawCount || 0,
      status: (managerResult.providers.directory?.status || 'NOT_NEEDED') as any,
      durationMs: managerResult.latencies.directoryMs || 0,
      reason: managerResult.providers.directory?.reason,
      errors: managerResult.providers.directory?.errors,
    };

    const output: BusinessDiscoveryOutput = {
      businesses: managerResult.businesses,
      rawCount: managerResult.totalDiscovered,
      sourceComplete: managerResult.sourceComplete,
      sourceStatus: managerResult.overallStatus,
      statusReason: managerResult.statusReason,
      queryUsed: params.industry,
      googleLatencyMs: managerResult.latencies.googleMs,
      osmLatencyMs: managerResult.latencies.osmMs,
      providerStats: {
        googlePlaces: gStat,
        osm: oStat,
        businessProvider: gStat,
        web: wStat,
        webSearch: wStat,
        directory: dStat,
      },
      totalDiscovered: managerResult.totalDiscovered,
      cacheHit: false,
    };

    // Store in query cache (24 hours TTL) if we found businesses
    if (managerResult.totalDiscovered > 0) {
      googleDiscoveryCache.setSearchQueryResults(searchKey, output);
    }

    return {
      data: output,
      sources: activeSources,
      warnings: managerResult.providers.googlePlaces.errors,
    };
  }
}

export const businessDiscoveryActor = new BusinessDiscoveryActor();
