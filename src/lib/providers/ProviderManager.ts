import { SearchDiscoveryParams, RawDiscoveredBusiness, DiscoveryResult } from '@/providers/BusinessDiscoveryProvider';
import { googlePlacesDiscoveryProvider } from '@/providers/GooglePlacesDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { webSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';
import { directoryDiscoveryProvider } from '@/providers/DirectoryDiscoveryProvider';
import { providerHealthService, SystemProvidersHealth } from './ProviderHealthService';
import { leadPilotDb } from '@/db';
import { normalizePhone } from '@/utils/phoneUtils';
import { extractDomain } from '@/utils/urlUtils';

export interface ProviderStatItem {
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_FAILURE' | 'NO_RESULTS' | 'NOT_NEEDED';
  rawCount: number;
  durationMs: number;
  reason?: string;
  errors?: string[];
}

export interface ProviderManagerResult {
  businesses: RawDiscoveredBusiness[];
  totalDiscovered: number;
  sourceComplete: boolean;
  overallStatus: 'COMPLETE' | 'PARTIAL' | 'NO_RESULTS' | 'PROVIDER_FAILURE' | 'PROVIDER_NOT_CONFIGURED';
  statusReason: string;
  primaryProvider: 'google_places' | 'osm';
  providers: {
    googlePlaces: ProviderStatItem;
    osm: ProviderStatItem;
    webSearch: ProviderStatItem;
    directory: ProviderStatItem;
  };
  latencies: {
    googleMs: number;
    osmMs: number;
    webMs: number;
    directoryMs: number;
    totalMs: number;
  };
}

/**
 * Executes an async task bounded by a strict timeout.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, providerName: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${providerName} query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

export class ProviderManager {
  /**
   * Orchestrates business discovery:
   * 1. Google Places (New) as PRIMARY provider with targetPool over-collection.
   * 2. If Google is sufficient (>= requestedLimit), fallback providers are NOT called.
   * 3. If Google is insufficient, unavailable, or times out, executes OSM + Web Search + Directory
   *    CONCURRENTLY with independent timeout budgets (Section 7, 8, 9).
   */
  public async executeDiscovery(
    params: SearchDiscoveryParams,
    onProgress?: (message: string, count?: number) => void
  ): Promise<ProviderManagerResult> {
    const startTime = Date.now();
    const requestedLimit = Math.max(Number(params.limit) || 20, 5);
    // Over-collect candidates: targetPool = max(requestedLimit * 3, 100) (Section 6 & 7)
    const targetPool = Math.max(requestedLimit * 3, 100);

    const health: SystemProvidersHealth = providerHealthService.checkHealth();

    const result: ProviderManagerResult = {
      businesses: [],
      totalDiscovered: 0,
      sourceComplete: false,
      overallStatus: 'NO_RESULTS',
      statusReason: '',
      primaryProvider: 'google_places',
      providers: {
        googlePlaces: { status: 'NOT_NEEDED', rawCount: 0, durationMs: 0, errors: [] },
        osm: { status: 'NOT_NEEDED', rawCount: 0, durationMs: 0, errors: [] },
        webSearch: { status: 'NOT_NEEDED', rawCount: 0, durationMs: 0, errors: [] },
        directory: { status: 'NOT_NEEDED', rawCount: 0, durationMs: 0, errors: [] },
      },
      latencies: {
        googleMs: 0,
        osmMs: 0,
        webMs: 0,
        directoryMs: 0,
        totalMs: 0,
      },
    };

    const isGoogleConfigured = health.googlePlaces.configured && health.googlePlaces.enabled;
    const seenBusinessKeys = new Set<string>();

    const addCandidateSafely = (b: RawDiscoveredBusiness, precedenceGoogle: boolean = false): boolean => {
      const cleanName = b.businessName ? b.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      if (!cleanName || cleanName.length < 2) return false;

      // Primary key check (source + sourceId)
      const primaryKey = `${b.source}:${b.sourceId || cleanName}`;
      if (seenBusinessKeys.has(primaryKey)) return false;

      // Coordinate proximity check (if within ~50m with same clean name)
      if (b.latitude && b.longitude) {
        for (const existing of result.businesses) {
          const existName = existing.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (existName === cleanName && existing.latitude && existing.longitude) {
            const latDiff = Math.abs(existing.latitude - b.latitude);
            const lonDiff = Math.abs(existing.longitude - b.longitude);
            if (latDiff < 0.0005 && lonDiff < 0.0005) {
              // Existing duplicate! If new one is Google and old is OSM, upgrade fields
              if (precedenceGoogle) {
                if (b.phone) existing.phone = b.phone;
                if (b.website) existing.website = b.website;
                existing.source = 'google_places';
              }
              return false;
            }
          }
        }
      }

      seenBusinessKeys.add(primaryKey);
      result.businesses.push(b);
      return true;
    };

    // --- STEP 1: GOOGLE PLACES PRIMARY EXECUTION ---
    if (isGoogleConfigured && health.googlePlaces.healthy) {
      onProgress?.('Executing Google Places API (Primary discovery provider)...');
      const gStart = Date.now();

      try {
        const googleRes = await withTimeout(
          googlePlacesDiscoveryProvider.discoverBusinesses({ ...params, limit: targetPool }),
          3500,
          'Google Places'
        );
        result.latencies.googleMs = Date.now() - gStart;
        result.providers.googlePlaces = {
          status: googleRes.status as any,
          rawCount: googleRes.rawCount,
          durationMs: result.latencies.googleMs,
          reason: googleRes.statusReason,
          errors: googleRes.errors,
        };

        if (googleRes.businesses.length > 0) {
          for (const b of googleRes.businesses) {
            addCandidateSafely(b, true);
          }
          onProgress?.(
            `Google Places discovered ${googleRes.rawCount} venues in ${(result.latencies.googleMs / 1000).toFixed(2)}s`,
            googleRes.rawCount
          );
        }
      } catch (gErr: any) {
        result.latencies.googleMs = Date.now() - gStart;
        result.providers.googlePlaces = {
          status: 'PROVIDER_FAILURE',
          rawCount: 0,
          durationMs: result.latencies.googleMs,
          reason: `Google Places execution failed: ${gErr.message}`,
          errors: [gErr.message],
        };
        onProgress?.(`Google Places encountered an error: ${gErr.message}. Evaluating fallback providers...`);
      }
    } else {
      result.providers.googlePlaces = {
        status: 'PROVIDER_NOT_CONFIGURED',
        rawCount: 0,
        durationMs: 0,
        reason: health.googlePlaces.message || 'GOOGLE_PLACES_API_KEY is missing or not configured.',
        errors: [health.googlePlaces.reason || 'MISSING_API_KEY'],
      };
      onProgress?.('Google Places is not configured (missing API key). Routing directly to fallback discovery pool...');
    }

    // --- STEP 2: CHECK SUFFICIENCY & TRIGGER CONCURRENT FALLBACKS IF NEEDED ---
    // If Google Places alone provided enough candidates to meet requestedLimit,
    // DO NOT invoke fallback providers! (Section 4 & 10)
    const googleCount = result.businesses.length;
    const needFallback = googleCount < requestedLimit;

    if (!needFallback) {
      // Primary provider satisfied the requirement completely!
      result.providers.osm = {
        status: 'NOT_NEEDED',
        rawCount: 0,
        durationMs: 0,
        reason: `Google Places satisfied the candidate target (${googleCount} candidates).`,
      };
      result.providers.webSearch = {
        status: 'NOT_NEEDED',
        rawCount: 0,
        durationMs: 0,
        reason: 'Google Places satisfied the candidate target.',
      };
      result.providers.directory = {
        status: 'NOT_NEEDED',
        rawCount: 0,
        durationMs: 0,
        reason: 'Google Places satisfied the candidate target.',
      };
    } else {
      // Candidate pool is insufficient: run fallback providers CONCURRENTLY via Promise.allSettled()
      // Section 8: OSM + Web Search + Directory execute concurrently with independent timeout budgets
      const fallbackMsg =
        googleCount === 0
          ? 'Querying fallback providers concurrently (OpenStreetMap + Web + Directory)...'
          : `Supplementing ${googleCount}/${requestedLimit} Google candidates with fallback providers...`;
      onProgress?.(fallbackMsg);

      const isOsmEnabled = health.osm.configured && health.osm.enabled;

      const fallbackTasks: Promise<any>[] = [];

      // Task 1: OSM Overpass (Timeout: 4000ms)
      if (isOsmEnabled) {
        fallbackTasks.push(
          (async () => {
            const oStart = Date.now();
            try {
              const res = await withTimeout(
                osmOverpassProvider.discoverBusinesses({ ...params, limit: targetPool }),
                4000,
                'OpenStreetMap Overpass'
              );
              result.latencies.osmMs = Date.now() - oStart;
              result.providers.osm = {
                status: res.status as any,
                rawCount: res.rawCount,
                durationMs: result.latencies.osmMs,
                reason: res.statusReason,
                errors: res.errors,
              };
              return { provider: 'osm', businesses: res.businesses };
            } catch (err: any) {
              result.latencies.osmMs = Date.now() - oStart;
              result.providers.osm = {
                status: 'PROVIDER_FAILURE',
                rawCount: 0,
                durationMs: result.latencies.osmMs,
                reason: err.message,
                errors: [err.message],
              };
              return { provider: 'osm', businesses: [] };
            }
          })()
        );
      } else {
        result.providers.osm = {
          status: 'PROVIDER_NOT_CONFIGURED',
          rawCount: 0,
          durationMs: 0,
          reason: 'OpenStreetMap provider is disabled via OSM_ENABLED=false.',
          errors: ['OSM_DISABLED'],
        };
      }

      // Task 2: Public Web Search Discovery (Timeout: 5000ms)
      fallbackTasks.push(
        (async () => {
          const wStart = Date.now();
          try {
            const res = await withTimeout(
              webSearchDiscoveryProvider.discoverBusinesses(params),
              5000,
              'Web Search Discovery'
            );
            result.latencies.webMs = Date.now() - wStart;
            result.providers.webSearch = {
              status: res.status as any,
              rawCount: res.rawCount,
              durationMs: result.latencies.webMs,
              reason: res.statusReason,
              errors: res.errors,
            };
            return { provider: 'webSearch', businesses: res.businesses };
          } catch (err: any) {
            result.latencies.webMs = Date.now() - wStart;
            result.providers.webSearch = {
              status: 'PROVIDER_FAILURE',
              rawCount: 0,
              durationMs: result.latencies.webMs,
              reason: err.message,
              errors: [err.message],
            };
            return { provider: 'webSearch', businesses: [] };
          }
        })()
      );

      // Task 3: Directory Discovery (Timeout: 5000ms)
      fallbackTasks.push(
        (async () => {
          const dStart = Date.now();
          try {
            const res = await withTimeout(
              directoryDiscoveryProvider.discoverBusinesses(params),
              5000,
              'Directory Discovery'
            );
            result.latencies.directoryMs = Date.now() - dStart;
            result.providers.directory = {
              status: res.status as any,
              rawCount: res.rawCount,
              durationMs: result.latencies.directoryMs,
              reason: res.statusReason,
              errors: res.errors,
            };
            return { provider: 'directory', businesses: res.businesses };
          } catch (err: any) {
            result.latencies.directoryMs = Date.now() - dStart;
            result.providers.directory = {
              status: 'PROVIDER_FAILURE',
              rawCount: 0,
              durationMs: result.latencies.directoryMs,
              reason: err.message,
              errors: [err.message],
            };
            return { provider: 'directory', businesses: [] };
          }
        })()
      );

      // Execute all fallback providers concurrently
      const settled = await Promise.allSettled(fallbackTasks);

      for (const item of settled) {
        if (item.status === 'fulfilled' && item.value?.businesses) {
          for (const b of item.value.businesses) {
            addCandidateSafely(b, false);
          }
        }
      }
    }

    result.latencies.totalMs = Date.now() - startTime;
    result.totalDiscovered = result.businesses.length;
    result.sourceComplete = result.totalDiscovered > 0;

    // --- STEP 3: STRICT SEARCH STATE CLASSIFICATION ---
    const gStatus = result.providers.googlePlaces.status;
    const oStatus = result.providers.osm.status;

    if (result.totalDiscovered > 0) {
      // Section 10 & 11: If candidate count is sufficient, status is COMPLETE
      result.overallStatus = result.totalDiscovered >= requestedLimit ? 'COMPLETE' : 'PARTIAL';
      result.statusReason = `Discovered ${result.totalDiscovered} real businesses (Google: ${result.providers.googlePlaces.rawCount}, OSM: ${result.providers.osm.rawCount}, Web: ${result.providers.webSearch.rawCount}, Directory: ${result.providers.directory.rawCount}).`;
    } else {
      // 0 businesses discovered across all providers
      if (gStatus === 'PROVIDER_NOT_CONFIGURED' && (oStatus === 'PROVIDER_FAILURE' || oStatus === 'FAILED')) {
        result.overallStatus = 'PROVIDER_FAILURE';
        result.statusReason = 'Google Places is not configured and OpenStreetMap fallback query failed.';
      } else if (gStatus === 'PROVIDER_NOT_CONFIGURED' && oStatus === 'PROVIDER_NOT_CONFIGURED') {
        result.overallStatus = 'PROVIDER_NOT_CONFIGURED';
        result.statusReason = 'No business discovery providers are configured on the server.';
      } else if (
        (gStatus === 'PROVIDER_FAILURE' || gStatus === 'FAILED') &&
        (oStatus === 'PROVIDER_FAILURE' || oStatus === 'FAILED')
      ) {
        result.overallStatus = 'PROVIDER_FAILURE';
        result.statusReason = 'All business discovery providers encountered errors or timed out.';
      } else {
        result.overallStatus = 'NO_RESULTS';
        result.statusReason = `No business records found for ${params.industry} in ${params.city || params.state}.`;
      }
    }

    return result;
  }

  /**
   * Executes parallel discovery if search planner specifies concurrent multi-source coverage.
   */
  public async executeParallelDiscovery(
    params: SearchDiscoveryParams,
    onProgress?: (message: string, count?: number) => void
  ): Promise<ProviderManagerResult> {
    return this.executeDiscovery(params, onProgress);
  }
}

export const providerManager = new ProviderManager();
