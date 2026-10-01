import {
  BusinessDiscoveryProvider,
  SearchDiscoveryParams,
  DiscoveryResult,
  RawDiscoveredBusiness,
} from './BusinessDiscoveryProvider';
import { queryOverpassBusinesses } from '@/lib/overpassClient';
import { resolveIndiaLocation } from '@/lib/geoResolver';

export class OSMOverpassProvider implements BusinessDiscoveryProvider {
  readonly providerId = 'osm';
  readonly name = 'OpenStreetMap Overpass Engine';

  public async discoverBusinesses(params: SearchDiscoveryParams): Promise<DiscoveryResult> {
    const startTime = Date.now();

    // Resolve bounding box if not provided
    let bbox: any = params.bbox;
    if (!bbox) {
      bbox = await resolveIndiaLocation(params.state, params.city);
    }

    const discovery = await queryOverpassBusinesses({
      industry: params.industry,
      state: params.state,
      city: params.city,
      bbox: bbox as any,
      limit: Math.max(params.limit || 50, 25),
    });

    const businesses: RawDiscoveredBusiness[] = discovery.leads.map((lead: any) => {
      const name = lead.businessName || lead.name || '';
      const postalCode = lead.postcode || lead.location?.postcode;
      return {
        source: 'osm',
        sources: ['osm'],
        sourceId: String(lead.osmId || lead.id),
        osmType: lead.osmType,
        osmId: lead.osmId ? Number(lead.osmId) : undefined,
        categoryTag: lead.categoryTag || lead.category,
        name,
        businessName: name,
        category: lead.category,
        address: lead.address || lead.location?.address || `${params.city || ''} ${params.state}`.trim(),
        city: lead.city || lead.location?.city || params.city,
        state: lead.state || lead.location?.state || params.state,
        postalCode,
        postcode: postalCode,
        latitude: lead.latitude || lead.coordinates?.lat,
        longitude: lead.longitude || lead.coordinates?.lon,
        phone: lead.phone && lead.phone !== 'Not available' ? lead.phone : undefined,
        email: lead.email && lead.email !== 'Not available' ? lead.email : undefined,
        website: lead.websiteUrl || (typeof lead.website === 'string' ? lead.website : lead.website?.url),
        openingHours: lead.openingHours,
        sourceUrl: lead.sourceUrl || (lead.osmType && lead.osmId ? `https://www.openstreetmap.org/${lead.osmType}/${lead.osmId}` : undefined),
        rawTags: lead.rawTags || {},
      };
    });

    return {
      providerId: this.providerId,
      providerName: this.name,
      resolvedAreaName: discovery.resolvedAreaName,
      rawCount: discovery.rawOsmCount,
      businesses,
      sourceComplete: discovery.sourceComplete,
      status: discovery.sourceComplete ? 'COMPLETE' : (discovery.rawOsmCount > 0 ? 'PARTIAL' : 'NO_RESULTS'),
      statusReason: discovery.statusReason,
      queryUsed: discovery.queryUsed,
      endpointUsed: discovery.endpointUsed,
      durationMs: Date.now() - startTime,
    };
  }
}

export const osmOverpassProvider = new OSMOverpassProvider();
