import { BaseActor, ActorContext } from '@/models/Actor';
import { RawDiscoveredBusiness, SearchDiscoveryParams, DiscoveryResult } from '@/providers/BusinessDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { secondaryBusinessDataProvider } from '@/providers/SecondaryBusinessDataProvider';
import { webSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';
import { directoryDiscoveryProvider } from '@/providers/DirectoryDiscoveryProvider';
import { leadPilotDb } from '@/db';

export interface ProviderStat {
  rawCount: number;
  discovered?: number;
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'DISABLED' | 'NO_RESULTS';
  durationMs: number;
  reason?: string;
  errors?: string[];
}

export interface BusinessDiscoveryOutput {
  businesses: RawDiscoveredBusiness[];
  rawCount: number;
  sourceComplete: boolean;
  statusReason?: string;
  queryUsed?: string;
  endpointUsed?: string;
  providerStats: {
    osm: ProviderStat;
    web: ProviderStat;
    webSearch: ProviderStat;
    businessProvider: ProviderStat;
    directory: ProviderStat;
  };
  totalDiscovered: number;
}

export class BusinessDiscoveryActor extends BaseActor<SearchDiscoveryParams, BusinessDiscoveryOutput> {
  readonly actorId = 'actor_business_discovery';
  readonly name = 'Multi-Source Business Discovery Actor';
  readonly timeoutMs = 90000;

  protected async run(context: ActorContext<SearchDiscoveryParams>): Promise<{
    data: BusinessDiscoveryOutput;
    sources: string[];
    warnings?: string[];
  }> {
    const params = context.input;
    const loc = params.city ? `${params.city}, ${params.state}` : params.state;
    context.onProgress?.(`Initiating parallel multi-source discovery for ${params.industry} in ${loc}...`);

    // Over-collection target: Request 2x-3x the desired lead count (min 150) to allow for filtration
    const overCollectTarget = Math.max(150, (params.limit || 50) * 2);
    const multiParams: SearchDiscoveryParams = {
      ...params,
      limit: overCollectTarget,
    };

    const cacheKey = `multi_discovery_v4:${params.industry}:${params.state}:${params.city || 'all'}`;
    const cached = leadPilotDb.getCache<BusinessDiscoveryOutput>(cacheKey);

    if (cached) {
      context.onProgress?.(
        `Retrieved ${cached.rawCount} multi-source candidates from discovery cache (OSM: ${cached.providerStats.osm.rawCount}, Web: ${cached.providerStats.web.rawCount}, Business Provider: ${cached.providerStats.businessProvider.rawCount})`,
        cached.rawCount
      );
      return {
        data: cached,
        sources: ['Multi-Source Discovery Cache'],
        warnings: ['Served from multi-source discovery cache.'],
      };
    }

    // Execute OSM, Secondary Business Provider, Web Search, and Directory concurrently
    const [osmSettled, bpSettled, webSettled, dirSettled] = await Promise.allSettled([
      osmOverpassProvider.discoverBusinesses(multiParams),
      secondaryBusinessDataProvider.discoverBusinesses(multiParams),
      webSearchDiscoveryProvider.discoverBusinesses(multiParams),
      directoryDiscoveryProvider.discoverBusinesses(multiParams),
    ]);

    const allBusinesses: RawDiscoveredBusiness[] = [];
    const activeSources: string[] = [];
    const warnings: string[] = [];

    // 1. Process OSM Overpass result (Baseline)
    const osmStat: ProviderStat = {
      rawCount: 0,
      discovered: 0,
      status: 'FAILED',
      durationMs: 0,
      errors: [],
    };
    if (osmSettled.status === 'fulfilled') {
      const res = osmSettled.value;
      osmStat.rawCount = res.rawCount;
      osmStat.discovered = res.rawCount;
      osmStat.status = res.status;
      osmStat.durationMs = res.durationMs;
      osmStat.reason = res.statusReason;
      osmStat.errors = res.errors || [];
      allBusinesses.push(...res.businesses);
      activeSources.push(res.providerName);
      context.onProgress?.(`OSM: Discovered ${res.rawCount} candidates in ${(res.durationMs / 1000).toFixed(1)}s`, res.rawCount);
    } else {
      osmStat.status = 'FAILED';
      const msg = osmSettled.reason?.message || 'OSM query timed out or failed';
      osmStat.reason = msg;
      osmStat.errors = [msg];
      warnings.push(`OSM provider failed: ${msg}`);
    }

    // 2. Process Secondary Business Data Provider result
    const bpStat: ProviderStat = {
      rawCount: 0,
      discovered: 0,
      status: 'DISABLED',
      durationMs: 0,
      errors: [],
    };
    if (bpSettled.status === 'fulfilled') {
      const res = bpSettled.value;
      bpStat.rawCount = res.rawCount;
      bpStat.discovered = res.rawCount;
      bpStat.status = res.status;
      bpStat.durationMs = res.durationMs;
      bpStat.reason = res.statusReason;
      bpStat.errors = res.errors || [];
      if (res.rawCount > 0) {
        allBusinesses.push(...res.businesses);
        activeSources.push(res.providerName);
      }
      context.onProgress?.(`Business Provider: [${res.status}] ${res.rawCount} candidates in ${(res.durationMs / 1000).toFixed(1)}s`, res.rawCount);
    } else {
      bpStat.status = 'FAILED';
      const msg = bpSettled.reason?.message || 'Secondary business data provider failed';
      bpStat.reason = msg;
      bpStat.errors = [msg];
      warnings.push(`Secondary business data provider failed: ${msg}`);
    }

    // 3. Process Public Web Search result
    const webStat: ProviderStat = {
      rawCount: 0,
      discovered: 0,
      status: 'FAILED',
      durationMs: 0,
      errors: [],
    };
    if (webSettled.status === 'fulfilled') {
      const res = webSettled.value;
      webStat.rawCount = res.rawCount;
      webStat.discovered = res.rawCount;
      webStat.status = res.status;
      webStat.durationMs = res.durationMs;
      webStat.reason = res.statusReason;
      webStat.errors = res.errors || [];
      if (res.rawCount > 0) {
        allBusinesses.push(...res.businesses);
        activeSources.push(res.providerName);
      }
      context.onProgress?.(`Web Search: Discovered ${res.rawCount} candidates in ${(res.durationMs / 1000).toFixed(1)}s`, res.rawCount);
    } else {
      webStat.status = 'FAILED';
      const msg = webSettled.reason?.message || 'Web search query timed out or failed';
      webStat.reason = msg;
      webStat.errors = [msg];
      warnings.push(`Web discovery failed: ${msg}`);
    }

    // 4. Process Directory result
    const dirStat: ProviderStat = {
      rawCount: 0,
      discovered: 0,
      status: 'FAILED',
      durationMs: 0,
      errors: [],
    };
    if (dirSettled.status === 'fulfilled') {
      const res = dirSettled.value;
      dirStat.rawCount = res.rawCount;
      dirStat.discovered = res.rawCount;
      dirStat.status = (res.sourceComplete ? 'COMPLETE' : 'PARTIAL') as any;
      dirStat.durationMs = res.durationMs;
      dirStat.reason = res.statusReason;
      if (res.rawCount > 0) {
        allBusinesses.push(...res.businesses);
        activeSources.push(res.providerName);
      }
    } else {
      dirStat.status = 'FAILED';
      dirStat.reason = dirSettled.reason?.message || 'Directory query timed out or failed';
    }

    const totalDiscovered = allBusinesses.length;
    const sourceComplete = osmStat.status === 'COMPLETE' && totalDiscovered > 0;

    let statusReason = `Discovered ${totalDiscovered} total candidate businesses across ${activeSources.length} providers.`;
    if (totalDiscovered === 0) {
      statusReason = `No business records found across available providers for ${params.industry} in ${loc}.`;
    }

    const output: BusinessDiscoveryOutput = {
      businesses: allBusinesses,
      rawCount: totalDiscovered,
      sourceComplete,
      statusReason,
      queryUsed: osmSettled.status === 'fulfilled' ? osmSettled.value.queryUsed : undefined,
      endpointUsed: osmSettled.status === 'fulfilled' ? osmSettled.value.endpointUsed : undefined,
      providerStats: {
        osm: osmStat,
        web: webStat,
        webSearch: webStat,
        businessProvider: bpStat,
        directory: dirStat,
      },
      totalDiscovered,
    };

    leadPilotDb.setCache(cacheKey, output, 3600000);

    return {
      data: output,
      sources: activeSources.length > 0 ? activeSources : ['OpenStreetMap Overpass Engine'],
      warnings,
    };
  }
}

export const businessDiscoveryActor = new BusinessDiscoveryActor();
