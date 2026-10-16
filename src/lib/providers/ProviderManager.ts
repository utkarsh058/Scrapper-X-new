import { SearchDiscoveryParams, RawDiscoveredBusiness, DiscoveryResult } from '@/providers/BusinessDiscoveryProvider';
import { outscraperDiscoveryProvider, OutscraperDiscoveryProvider } from '@/providers/OutscraperDiscoveryProvider';
import { googlePlacesDiscoveryProvider, GooglePlacesDiscoveryProvider } from '@/providers/GooglePlacesDiscoveryProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { webSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';
import { directoryDiscoveryProvider } from '@/providers/DirectoryDiscoveryProvider';
import { providerHealthService, SystemProvidersHealth } from './ProviderHealthService';
import { getTimeoutConfig } from '@/lib/config/concurrencyConfig';

export interface ProviderStatItem {
  status:
    | 'SUCCESS'
    | 'COMPLETE'
    | 'PARTIAL'
    | 'FAILED'
    | 'DISABLED'
    | 'NOT_CONFIGURED'
    | 'PROVIDER_NOT_CONFIGURED'
    | 'PROVIDER_FAILURE'
    | 'NO_RESULTS'
    | 'NOT_NEEDED'
    | 'AUTH_FAILED'
    | 'RATE_LIMITED'
    | 'REQUEST_FAILED';
  rawCount: number;
  discovered?: number;
  pagesRequested?: number;
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
  primaryProvider: 'outscraper' | 'google_places' | 'osm';
  providers: {
    outscraper?: ProviderStatItem;
    googlePlaces: ProviderStatItem;
    osm: ProviderStatItem;
    webSearch: ProviderStatItem;
    directory: ProviderStatItem;
  };
  latencies: {
    outscraperMs?: number;
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
   * 1. Outscraper Google Maps Engine as PRIMARY provider (configurable via PRIMARY_DISCOVERY_PROVIDER).
   * 2. Google Places (New) as MODULAR provider: disabled until explicitly enabled via GOOGLE_PLACES_ENABLED=true.
   * 3. OpenStreetMap Overpass as SECONDARY / RELIABLE FALLBACK provider.
   * 4. Public Web Search / Directory as SUPPLEMENTAL providers if needed.
   * 5. MultiSourceMergeActor executes downstream to merge overlapping candidates.
   */
  public async executeDiscovery(
    params: SearchDiscoveryParams,
    onProgress?: (message: string, count?: number) => void
  ): Promise<ProviderManagerResult> {
    const startTime = Date.now();
    const requestedLimit = Math.max(Number(params.limit) || 20, 5);
    // Over-collect candidates: targetPool = max(requestedLimit * 3, 60)
    const targetPool = Math.max(requestedLimit * 3, 60);

    const health: SystemProvidersHealth = providerHealthService.checkHealth();

    // Determine configured primary provider (default: 'outscraper')
    const primaryConfig = (process.env.PRIMARY_DISCOVERY_PROVIDER || 'outscraper').toLowerCase().trim();
    const isOutscraperPrimary = primaryConfig !== 'google_places';

    const result: ProviderManagerResult = {
      businesses: [],
      totalDiscovered: 0,
      sourceComplete: false,
      overallStatus: 'NO_RESULTS',
      statusReason: '',
      primaryProvider: isOutscraperPrimary ? 'outscraper' : 'google_places',
      providers: {
        outscraper: {
          status: !health.outscraper.enabled ? 'DISABLED' : !health.outscraper.configured ? 'NOT_CONFIGURED' : 'NOT_NEEDED',
          rawCount: 0,
          discovered: 0,
          durationMs: 0,
          errors: [],
        },
        googlePlaces: {
          status: !health.googlePlaces.enabled ? 'DISABLED' : !health.googlePlaces.configured ? 'NOT_CONFIGURED' : 'NOT_NEEDED',
          rawCount: 0,
          discovered: 0,
          pagesRequested: 0,
          durationMs: 0,
          errors: [],
        },
        osm: { status: 'NOT_NEEDED', rawCount: 0, discovered: 0, durationMs: 0, errors: [] },
        webSearch: { status: 'NOT_NEEDED', rawCount: 0, discovered: 0, durationMs: 0, errors: [] },
        directory: { status: 'NOT_NEEDED', rawCount: 0, discovered: 0, durationMs: 0, errors: [] },
      },
      latencies: {
        outscraperMs: 0,
        googleMs: 0,
        osmMs: 0,
        webMs: 0,
        directoryMs: 0,
        totalMs: 0,
      },
    };

    const seenProviderKeys = new Set<string>();

    const addCandidate = (b: RawDiscoveredBusiness) => {
      const pKey = `${b.source}:${b.sourceId}`;
      if (seenProviderKeys.has(pKey)) return;
      seenProviderKeys.add(pKey);
      result.businesses.push(b);
    };

    // Helper: Execute Outscraper provider
    const runOutscraper = async () => {
      const isOutscraperConfigured = health.outscraper.configured && health.outscraper.enabled;
      if (isOutscraperConfigured && health.outscraper.healthy) {
        onProgress?.('Executing Outscraper Google Maps Engine as Primary discovery provider...');
        const oStart = Date.now();
        const timeouts = getTimeoutConfig();
        const outscraperTimeoutMs = Math.max(timeouts.outscraperFastMs || 15000, 15000);

        try {
          const outscraperRes = await withTimeout(
            outscraperDiscoveryProvider.discoverBusinesses({ ...params, limit: targetPool }),
            outscraperTimeoutMs,
            'Outscraper Google Maps Engine'
          );
          result.latencies.outscraperMs = Date.now() - oStart;
          result.providers.outscraper = {
            status: outscraperRes.status as any,
            rawCount: outscraperRes.rawCount,
            discovered: outscraperRes.rawCount,
            pagesRequested: outscraperRes.pagesRequested || (outscraperRes.rawCount > 0 ? 1 : 0),
            durationMs: result.latencies.outscraperMs,
            reason: outscraperRes.statusReason,
            errors: outscraperRes.errors || [],
          };

          if (outscraperRes.businesses.length > 0) {
            for (const b of outscraperRes.businesses) {
              addCandidate(b);
            }
            onProgress?.(
              `Outscraper discovered ${outscraperRes.rawCount} venues in ${(result.latencies.outscraperMs / 1000).toFixed(2)}s`,
              outscraperRes.rawCount
            );
          }
        } catch (oErr: any) {
          result.latencies.outscraperMs = Date.now() - oStart;
          const errMsg = oErr.message || '';
          const isAuth = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('Unauthorized');
          const isRate = errMsg.includes('429') || errMsg.includes('402') || errMsg.includes('quota') || errMsg.includes('credits');
          const status = isAuth ? 'AUTH_FAILED' : isRate ? 'RATE_LIMITED' : 'REQUEST_FAILED';
          result.providers.outscraper = {
            status: status as any,
            rawCount: 0,
            discovered: 0,
            durationMs: result.latencies.outscraperMs,
            reason: `Outscraper execution failed: ${errMsg}`,
            errors: [errMsg],
          };
          onProgress?.(`Outscraper encountered an error (${status}): ${errMsg}.`);
        }
      } else {
        let disabledStatus: 'DISABLED' | 'NOT_CONFIGURED' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_FAILURE' = 'DISABLED';
        if (!health.outscraper.enabled) {
          disabledStatus = 'DISABLED';
        } else if (!health.outscraper.configured) {
          disabledStatus = 'NOT_CONFIGURED';
        } else {
          disabledStatus = 'PROVIDER_FAILURE';
        }

        result.providers.outscraper = {
          status: disabledStatus as any,
          rawCount: 0,
          discovered: 0,
          durationMs: 0,
          reason: health.outscraper.message || 'OUTSCRAPER_API_KEY is not configured on the server.',
          errors: [health.outscraper.reason || 'MISSING_API_KEY'],
        };
        onProgress?.(`Outscraper is not active (${health.outscraper.reason || 'NOT_CONFIGURED'}).`);
      }
    };

    // Helper: Execute Google Places provider (ONLY IF EXPLICITLY ENABLED)
    const runGooglePlaces = async () => {
      const isGoogleConfigured = health.googlePlaces.configured && health.googlePlaces.enabled;
      if (isGoogleConfigured && health.googlePlaces.healthy) {
        onProgress?.('Executing Google Places API (New)...');
        const gStart = Date.now();
        const timeouts = getTimeoutConfig();
        const googleTimeoutMs = Math.max((timeouts.googlePlacesFastMs || 8000) * 2, 20000);

        try {
          const googleRes = await withTimeout(
            googlePlacesDiscoveryProvider.discoverBusinesses({ ...params, limit: targetPool }),
            googleTimeoutMs,
            'Google Places API'
          );
          result.latencies.googleMs = Date.now() - gStart;
          result.providers.googlePlaces = {
            status: googleRes.status as any,
            rawCount: googleRes.rawCount,
            discovered: googleRes.rawCount,
            pagesRequested: googleRes.pagesRequested || (googleRes.rawCount > 0 ? 1 : 0),
            durationMs: result.latencies.googleMs,
            reason: googleRes.statusReason,
            errors: googleRes.errors || [],
          };

          if (googleRes.businesses.length > 0) {
            for (const b of googleRes.businesses) {
              addCandidate(b);
            }
            onProgress?.(
              `Google Places discovered ${googleRes.rawCount} venues in ${(result.latencies.googleMs / 1000).toFixed(2)}s`,
              googleRes.rawCount
            );
          }
        } catch (gErr: any) {
          result.latencies.googleMs = Date.now() - gStart;
          const errMsg = gErr.message || '';
          const isAuth = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('PERMISSION_DENIED');
          const isRate = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
          const status = isAuth ? 'AUTH_FAILED' : isRate ? 'RATE_LIMITED' : 'REQUEST_FAILED';
          result.providers.googlePlaces = {
            status: status as any,
            rawCount: 0,
            discovered: 0,
            pagesRequested: 1,
            durationMs: result.latencies.googleMs,
            reason: `Google Places execution failed: ${errMsg}`,
            errors: [errMsg],
          };
          onProgress?.(`Google Places encountered an error (${status}): ${errMsg}.`);
        }
      } else {
        let disabledStatus: 'DISABLED' | 'NOT_CONFIGURED' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_FAILURE' = 'DISABLED';
        if (!health.googlePlaces.enabled) {
          disabledStatus = 'DISABLED';
        } else if (!health.googlePlaces.configured) {
          disabledStatus = 'NOT_CONFIGURED';
        } else {
          disabledStatus = 'PROVIDER_FAILURE';
        }

        result.providers.googlePlaces = {
          status: disabledStatus as any,
          rawCount: 0,
          discovered: 0,
          pagesRequested: 0,
          durationMs: 0,
          reason: health.googlePlaces.message || 'Google Places is currently disabled. Set GOOGLE_PLACES_ENABLED=true to activate.',
          errors: [health.googlePlaces.reason || 'GOOGLE_PLACES_DISABLED'],
        };
      }
    };

    // --- STEP 1: EXECUTE PRIMARY DISCOVERY PROVIDER ---
    if (isOutscraperPrimary) {
      await runOutscraper();

      // Check if Google Places is explicitly enabled and needed
      const outscraperFailed = [
        'FAILED',
        'DISABLED',
        'NOT_CONFIGURED',
        'PROVIDER_NOT_CONFIGURED',
        'PROVIDER_FAILURE',
        'AUTH_FAILED',
        'REQUEST_FAILED',
        'RATE_LIMITED',
        'NO_RESULTS',
      ].includes(result.providers.outscraper?.status || 'DISABLED');

      const needGoogle = (outscraperFailed || result.businesses.length < requestedLimit * 1.5) && (health.googlePlaces.enabled || GooglePlacesDiscoveryProvider.getSimulateResults() !== null);
      if (needGoogle) {
        await runGooglePlaces();
      }
    } else {
      // Configured with Google Places as Primary
      await runGooglePlaces();

      const googleFailed = [
        'FAILED',
        'DISABLED',
        'NOT_CONFIGURED',
        'PROVIDER_NOT_CONFIGURED',
        'PROVIDER_FAILURE',
        'AUTH_FAILED',
        'REQUEST_FAILED',
        'RATE_LIMITED',
        'NO_RESULTS',
      ].includes(result.providers.googlePlaces.status);

      const needOutscraper = (googleFailed || result.businesses.length < requestedLimit * 1.5) && (health.outscraper.configured && health.outscraper.enabled);
      if (needOutscraper) {
        await runOutscraper();
      }
    }

    // --- STEP 2: OPENSTREETMAP AS SECONDARY / FALLBACK PROVIDER ---
    // Only invoke OSM if primary / secondary returned insufficient candidates or encountered errors
    const isOsmEnabled = health.osm.configured && health.osm.enabled;
    const primaryStatus = isOutscraperPrimary ? result.providers.outscraper?.status : result.providers.googlePlaces.status;
    const primaryFailed = [
      'FAILED',
      'DISABLED',
      'NOT_CONFIGURED',
      'PROVIDER_NOT_CONFIGURED',
      'PROVIDER_FAILURE',
      'AUTH_FAILED',
      'REQUEST_FAILED',
      'RATE_LIMITED',
      'NO_RESULTS',
    ].includes(primaryStatus || 'DISABLED');

    const needOsm = primaryFailed || result.businesses.length < requestedLimit * 1.5;

    if (isOsmEnabled && needOsm) {
      onProgress?.('Executing OpenStreetMap Overpass as Fallback discovery source...');
      const oStart = Date.now();
      const osmTimeouts = getTimeoutConfig();
      const osmTimeoutMs = Math.max(osmTimeouts.osmFastMs || 6000, 10000);

      try {
        const osmRes = await withTimeout(
          osmOverpassProvider.discoverBusinesses({ ...params, limit: targetPool }),
          osmTimeoutMs,
          'OpenStreetMap Overpass'
        );
        result.latencies.osmMs = Date.now() - oStart;
        result.providers.osm = {
          status: osmRes.status as any,
          rawCount: osmRes.rawCount,
          discovered: osmRes.rawCount,
          durationMs: result.latencies.osmMs,
          reason: osmRes.statusReason,
          errors: osmRes.errors || [],
        };

        if (osmRes.businesses.length > 0) {
          for (const b of osmRes.businesses) {
            addCandidate(b);
          }
          onProgress?.(
            `OpenStreetMap discovered ${osmRes.rawCount} venues in ${(result.latencies.osmMs / 1000).toFixed(2)}s`,
            osmRes.rawCount
          );
        }
      } catch (oErr: any) {
        result.latencies.osmMs = Date.now() - oStart;
        const errMsg = oErr.message || '';
        const isRate = errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('busy');
        result.providers.osm = {
          status: (isRate ? 'RATE_LIMITED' : 'REQUEST_FAILED') as any,
          rawCount: 0,
          discovered: 0,
          durationMs: result.latencies.osmMs,
          reason: errMsg,
          errors: [errMsg],
        };
      }
    } else if (isOsmEnabled && !needOsm) {
      result.providers.osm = {
        status: 'NOT_NEEDED',
        rawCount: 0,
        discovered: 0,
        durationMs: 0,
        reason: 'Primary discovery provider provided sufficient candidates; OSM supplemental discovery bypassed for latency.',
        errors: [],
      };
    } else {
      result.providers.osm = {
        status: 'DISABLED',
        rawCount: 0,
        discovered: 0,
        durationMs: 0,
        reason: 'OpenStreetMap provider is disabled via OSM_ENABLED=false.',
        errors: ['OSM_DISABLED'],
      };
    }

    // --- STEP 3: SUPPLEMENTAL WEB SEARCH / DIRECTORY IF NEEDED ---
    const currentCount = result.businesses.length;
    if (currentCount < requestedLimit) {
      onProgress?.('Supplementing discovery pool with public web search...');
      const wStart = Date.now();
      try {
        const webRes = await withTimeout(
          webSearchDiscoveryProvider.discoverBusinesses(params),
          5000,
          'Web Search Discovery'
        );
        result.latencies.webMs = Date.now() - wStart;
        result.providers.webSearch = {
          status: webRes.status as any,
          rawCount: webRes.rawCount,
          discovered: webRes.rawCount,
          durationMs: result.latencies.webMs,
          reason: webRes.statusReason,
          errors: webRes.errors || [],
        };
        for (const b of webRes.businesses) {
          addCandidate(b);
        }
      } catch (wErr: any) {
        result.latencies.webMs = Date.now() - wStart;
        result.providers.webSearch = {
          status: 'FAILED',
          rawCount: 0,
          discovered: 0,
          durationMs: result.latencies.webMs,
          reason: wErr.message,
          errors: [wErr.message],
        };
      }
    } else {
      result.providers.webSearch = {
        status: 'NOT_NEEDED',
        rawCount: 0,
        discovered: 0,
        durationMs: 0,
        reason: 'Primary and secondary discovery sources provided sufficient candidate volume.',
        errors: [],
      };
    }

    result.latencies.totalMs = Date.now() - startTime;
    result.totalDiscovered = result.businesses.length;
    result.sourceComplete = result.totalDiscovered > 0;

    // --- STEP 4: STRICT SEARCH STATE CLASSIFICATION ---
    const activePrimaryStat = isOutscraperPrimary ? result.providers.outscraper : result.providers.googlePlaces;
    const pStatus = activePrimaryStat?.status || 'DISABLED';
    const oStatus = result.providers.osm.status;

    if (result.totalDiscovered > 0) {
      result.overallStatus = result.totalDiscovered >= requestedLimit ? 'COMPLETE' : 'PARTIAL';
      const breakdown = [
        result.providers.outscraper?.rawCount ? `Outscraper: ${result.providers.outscraper.rawCount}` : null,
        result.providers.googlePlaces.rawCount ? `Google Places: ${result.providers.googlePlaces.rawCount}` : null,
        result.providers.osm.rawCount ? `OSM: ${result.providers.osm.rawCount}` : null,
        result.providers.webSearch?.rawCount ? `Web: ${result.providers.webSearch.rawCount}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      result.statusReason = `Discovered ${result.totalDiscovered} candidates (${breakdown || 'verified'}).`;
    } else {
      const pFailed = ['FAILED', 'PROVIDER_FAILURE', 'AUTH_FAILED', 'RATE_LIMITED', 'REQUEST_FAILED'].includes(pStatus);
      const oFailed = ['FAILED', 'PROVIDER_FAILURE', 'RATE_LIMITED', 'REQUEST_FAILED'].includes(oStatus);

      if (pFailed && oFailed) {
        result.overallStatus = 'PROVIDER_FAILURE';
        result.statusReason = `All business discovery providers encountered errors (${isOutscraperPrimary ? 'Outscraper' : 'Google Places'}: ${pStatus}, OSM: ${oStatus}).`;
      } else if (
        (pStatus === 'DISABLED' || pStatus === 'NOT_CONFIGURED' || pStatus === 'PROVIDER_NOT_CONFIGURED') &&
        oFailed
      ) {
        result.overallStatus = 'PROVIDER_FAILURE';
        result.statusReason = `${isOutscraperPrimary ? 'Outscraper' : 'Google Places'} is not configured and OpenStreetMap fallback failed (${oStatus}).`;
      } else if (
        (pStatus === 'DISABLED' || pStatus === 'NOT_CONFIGURED' || pStatus === 'PROVIDER_NOT_CONFIGURED') &&
        oStatus === 'DISABLED'
      ) {
        result.overallStatus = 'PROVIDER_NOT_CONFIGURED';
        result.statusReason = 'No business discovery providers are configured on the server.';
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
