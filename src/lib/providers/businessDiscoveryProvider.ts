import { BusinessDiscoveryProvider, DiscoveredBusiness, DiscoveryCriteria } from './types';
import { queryOverpassBusinesses } from '../overpassClient';
import { resolveIndiaLocation } from '../geoResolver';
import { googlePlacesNewProvider } from './googlePlacesNewProvider';
import { googlePlacesCircuitBreaker, osmCircuitBreaker } from '../resilience/CircuitBreaker';
import { googleUsageTracker } from '../billing/GoogleUsageTracker';
import { googleDiscoveryCache } from '../cache/GoogleDiscoveryCache';

export interface ProviderReportItem {
  status: 'SUCCESS' | 'FAILED' | 'DISABLED' | 'NOT_NEEDED';
  discovered: number;
  error?: string;
  durationMs?: number;
}

export interface ProvidersStatusReport {
  osm: ProviderReportItem;
  googlePlaces: ProviderReportItem;
}

/**
 * Production Business Discovery using Google Places API (New)
 */
export class GooglePlacesDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = 'google_places';

  isConfigured(): boolean {
    return googlePlacesNewProvider.isConfigured();
  }

  async searchBusinesses(criteria: DiscoveryCriteria): Promise<DiscoveredBusiness[]> {
    const rawResult = await googlePlacesNewProvider.discoverBusinesses({
      industry: criteria.industry,
      state: criteria.state,
      city: criteria.city,
      country: criteria.country,
      limit: criteria.limit,
    });

    const now = new Date().toISOString();

    return rawResult.businesses.map((b) => ({
      provider: this.name,
      sourceId: b.sourceId,
      name: b.name,
      category: b.category,
      industry: criteria.industry,
      address: b.address,
      city: criteria.city || criteria.state,
      state: criteria.state,
      country: criteria.country || 'India',
      latitude: b.latitude,
      longitude: b.longitude,
      phone: b.phone ?? undefined,
      websiteUrl: b.website ?? undefined,
      businessStatus: 'OPERATIONAL',
      rawPayload: b.rawTags,
      sourceUrl: b.sourceUrl || `https://www.google.com/maps/place/?q=place_id:${b.sourceId}`,
      collectedAt: now,
    }));
  }
}

/**
 * Secondary Discovery Provider using OpenStreetMap Overpass API
 */
export class OpenStreetMapDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = 'openstreetmap';

  isConfigured(): boolean {
    return true; // Uses public mirrors
  }

  async searchBusinesses(criteria: DiscoveryCriteria): Promise<DiscoveredBusiness[]> {
    const bbox = await resolveIndiaLocation(criteria.state, criteria.city);
    const discoveryResult = await osmCircuitBreaker.execute(async () => {
      return await queryOverpassBusinesses({
        industry: criteria.industry,
        state: criteria.state,
        city: criteria.city,
        bbox,
        limit: criteria.limit,
      });
    });

    const leads = discoveryResult?.leads || [];
    const now = new Date().toISOString();

    return leads.map((l: any) => ({
      provider: this.name,
      sourceId: l.sourceId || l.id,
      name: l.businessName || l.name,
      category: l.category || criteria.industry,
      industry: l.industry || criteria.industry,
      address: l.address || '',
      city: l.city || criteria.city || criteria.state,
      state: l.state || criteria.state,
      country: criteria.country || 'India',
      postcode: l.postcode || l.postalCode,
      latitude: l.latitude,
      longitude: l.longitude,
      phone: l.phone,
      websiteUrl: l.websiteUrl || l.website,
      businessStatus: l.businessStatus || 'OPERATIONAL',
      sourceUrl: l.sourceUrl || `https://www.openstreetmap.org/${(l.sourceId || '').replace('osm:', '').replace(':', '/')}`,
      collectedAt: now,
    }));
  }
}

/**
 * Production Composite Discovery Provider
 * Google Places is PRIMARY.
 * OpenStreetMap is SECONDARY / FALLBACK when Google is unavailable, times out,
 * hits budget limit, or yields insufficient coverage.
 */
export class CompositeBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = 'composite_discovery';
  public googlePlaces = new GooglePlacesDiscoveryProvider();
  public osm = new OpenStreetMapDiscoveryProvider();

  private lastProvidersReport: ProvidersStatusReport = {
    osm: { status: 'SUCCESS', discovered: 0 },
    googlePlaces: { status: 'DISABLED', discovered: 0 },
  };

  private lastSourceStatus: 'COMPLETE' | 'PARTIAL' | 'FAILED' = 'COMPLETE';

  public getLastProvidersReport(): ProvidersStatusReport {
    return { ...this.lastProvidersReport };
  }

  public getLastSourceStatus(): 'COMPLETE' | 'PARTIAL' | 'FAILED' {
    return this.lastSourceStatus;
  }

  isConfigured(): boolean {
    return true;
  }

  async searchBusinesses(criteria: DiscoveryCriteria): Promise<DiscoveredBusiness[]> {
    const results: DiscoveredBusiness[] = [];
    const requestedLimit = criteria.limit || 20;

    let googleSuccess = false;
    let osmSuccess = false;

    // 1. Google Places Primary
    const isGoogleConfigured = this.googlePlaces.isConfigured();
    const budgetCheck = googleUsageTracker.canExecuteGoogleRequest();

    if (isGoogleConfigured && budgetCheck.allowed && googlePlacesCircuitBreaker.getState() !== 'OPEN') {
      const gStart = Date.now();
      try {
        const googleResults = await this.googlePlaces.searchBusinesses(criteria);
        const gDur = Date.now() - gStart;
        this.lastProvidersReport.googlePlaces = {
          status: 'SUCCESS',
          discovered: googleResults.length,
          durationMs: gDur,
        };
        results.push(...googleResults);
        googleSuccess = true;
      } catch (err: any) {
        console.warn('[DiscoveryProvider] Google Places failed, falling back to OSM:', err.message);
        this.lastProvidersReport.googlePlaces = {
          status: 'FAILED',
          discovered: 0,
          error: err.message,
        };
      }
    } else {
      this.lastProvidersReport.googlePlaces = {
        status: !isGoogleConfigured ? 'DISABLED' : 'NOT_NEEDED',
        discovered: 0,
        error: budgetCheck.reason,
      };
    }

    // 2. OpenStreetMap (OSM) Fallback or Supplemental
    // If Google already returned sufficient candidates (>= requestedLimit), DO NOT block on OSM!
    const needOsm = results.length < requestedLimit;

    if (needOsm) {
      const oStart = Date.now();
      try {
        const osmResults = await this.osm.searchBusinesses(criteria);
        const oDur = Date.now() - oStart;
        this.lastProvidersReport.osm = {
          status: 'SUCCESS',
          discovered: osmResults.length,
          durationMs: oDur,
        };
        osmSuccess = true;

        // Deduplicate against Google Places by normalized name
        const existingNames = new Set(results.map((r) => r.name.toLowerCase().trim()));
        for (const osmBiz of osmResults) {
          if (!existingNames.has(osmBiz.name.toLowerCase().trim())) {
            results.push(osmBiz);
          }
        }
      } catch (err: any) {
        console.warn('[DiscoveryProvider] OpenStreetMap fallback failed:', err.message);
        this.lastProvidersReport.osm = {
          status: 'FAILED',
          discovered: 0,
          error: err.message,
        };
      }
    } else {
      this.lastProvidersReport.osm = {
        status: 'NOT_NEEDED',
        discovered: 0,
      };
    }

    if (results.length > 0) {
      this.lastSourceStatus = results.length >= requestedLimit ? 'COMPLETE' : 'PARTIAL';
    } else {
      this.lastSourceStatus = 'FAILED';
    }

    return results;
  }
}

export const businessDiscovery = new CompositeBusinessDiscoveryProvider();
