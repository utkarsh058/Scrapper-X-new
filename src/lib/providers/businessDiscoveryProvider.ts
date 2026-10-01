import { BusinessDiscoveryProvider, DiscoveredBusiness, DiscoveryCriteria } from './types';
import { queryOverpassBusinesses } from '../overpassClient';
import { resolveIndiaLocation } from '../geoResolver';

/**
 * Production Business Discovery using Google Places API (New)
 */
export class GooglePlacesDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = 'google_places';

  isConfigured(): boolean {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  async searchBusinesses(criteria: DiscoveryCriteria): Promise<DiscoveredBusiness[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('PROVIDER_NOT_CONFIGURED: Google Places API key is missing.');
    }

    const locationQuery = [criteria.city, criteria.state, criteria.country].filter(Boolean).join(', ');
    const textQuery = `${criteria.industry} in ${locationQuery}`;
    const pageSize = Math.min(Math.max(criteria.limit, 1), 20);

    const url = 'https://places.googleapis.com/v1/places:searchText';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus',
      },
      body: JSON.stringify({
        textQuery,
        pageSize,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Places API returned HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const places = data.places || [];
    const now = new Date().toISOString();

    return places.map((p: any) => ({
      provider: this.name,
      sourceId: p.id,
      name: p.displayName?.text || 'Unnamed Business',
      category: p.primaryTypeDisplayName?.text || criteria.industry,
      industry: criteria.industry,
      address: p.formattedAddress,
      city: criteria.city || criteria.state,
      state: criteria.state,
      country: criteria.country || 'India',
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
      websiteUrl: p.websiteUri,
      rating: p.rating,
      reviewCount: p.userRatingCount,
      businessStatus: p.businessStatus || 'OPERATIONAL',
      rawPayload: p,
      sourceUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
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
    const leads = await queryOverpassBusinesses({
      industry: criteria.industry,
      state: criteria.state,
      city: criteria.city,
      bbox,
      limit: criteria.limit,
    });

    const now = new Date().toISOString();

    return leads.map((l) => ({
      provider: this.name,
      sourceId: l.sourceId || l.id,
      name: l.businessName,
      category: l.category,
      industry: l.industry,
      address: l.address,
      city: l.city,
      state: l.state,
      country: criteria.country || 'India',
      postcode: l.postcode,
      latitude: l.latitude,
      longitude: l.longitude,
      phone: l.phone,
      websiteUrl: l.websiteUrl,
      businessStatus: l.businessStatus || 'OPERATIONAL',
      sourceUrl: `https://www.openstreetmap.org/${(l.sourceId || '').replace('osm:', '').replace(':', '/')}`,
      collectedAt: now,
    }));
  }
}

/**
 * Production Composite Discovery Provider
 * Selects Google Places if configured; falls back gracefully to OpenStreetMap
 */
export class CompositeBusinessDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = 'composite_discovery';
  private googlePlaces = new GooglePlacesDiscoveryProvider();
  private osm = new OpenStreetMapDiscoveryProvider();

  isConfigured(): boolean {
    return true;
  }

  async searchBusinesses(criteria: DiscoveryCriteria): Promise<DiscoveredBusiness[]> {
    // 1. Try Google Places if configured
    if (this.googlePlaces.isConfigured()) {
      try {
        const results = await this.googlePlaces.searchBusinesses(criteria);
        if (results && results.length > 0) {
          return results;
        }
      } catch (err: any) {
        console.warn('[DiscoveryProvider] Google Places failed, falling back to OSM:', err.message);
      }
    }

    // 2. Fallback to OpenStreetMap
    return this.osm.searchBusinesses(criteria);
  }
}

export const businessDiscovery = new CompositeBusinessDiscoveryProvider();
