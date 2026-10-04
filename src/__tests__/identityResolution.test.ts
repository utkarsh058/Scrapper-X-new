import { describe, it, expect } from 'vitest';
import { BusinessIdentityResolutionService } from '@/services/identity/BusinessIdentityResolutionService';
import { GoogleBusinessCandidate, OSMProfileCandidate } from '@/types/canonical';

describe('BusinessIdentityResolutionService (Section 12, 42)', () => {
  const service = new BusinessIdentityResolutionService();

  it('matches candidates by exact Google Place ID', () => {
    const a = { name: 'Punjab Grill', placeId: 'ChIJ12345' };
    const b = { name: 'Punjab Grill Resto', placeId: 'ChIJ12345' };

    const match = service.matchCandidates(a, b);
    expect(match.matched).toBe(true);
    expect(match.confidence).toBe(1.0);
  });

  it('matches candidates by phone number despite formatting differences', () => {
    const a = { name: 'Desi Flavours', phone: '+91 98111 22334' };
    const b = { name: 'Desi Flavours Restaurant', phone: '09811122334' };

    const match = service.matchCandidates(a, b);
    expect(match.matched).toBe(true);
    expect(match.confidence).toBeGreaterThanOrEqual(0.9);
    expect(match.evidence).toContain('phone_match');
  });

  it('matches candidates by website domain and name similarity', () => {
    const a = { name: 'Barbeque Nation', website: 'https://www.barbequenation.com/outlets/noida' };
    const b = { name: 'Barbeque Nation', website: 'https://barbequenation.com' };

    const match = service.matchCandidates(a, b);
    expect(match.matched).toBe(true);
    expect(match.confidence).toBeGreaterThanOrEqual(0.9);
    expect(match.evidence).toContain('domain_match');
  });

  it('merges Google and OSM candidates into a single CanonicalBusiness preserving sources', () => {
    const googleCandidate: GoogleBusinessCandidate = {
      externalId: 'google_ChIJ_test',
      source: 'google_places',
      placeId: 'ChIJ_test',
      name: 'Radisson Blu Hotel Greater Noida',
      category: 'hotel',
      categories: ['hotel', 'lodging'],
      address: 'C-8, Site 4, Greater Noida, UP',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: null,
      latitude: 28.472,
      longitude: 77.502,
      phone: '+91 120 450 0000',
      internationalPhone: '+91 120 450 0000',
      website: 'https://www.radissonhotels.com',
      googleMapsUrl: 'https://maps.google.com/?cid=123',
      businessStatus: 'OPERATIONAL',
      rating: 4.5,
      reviewCount: 3200,
      openingHours: null,
      capturedAt: new Date(),
    };

    const osmCandidate: OSMProfileCandidate = {
      externalId: 'osm_node_998877',
      source: 'openstreetmap',
      osmId: '998877',
      osmType: 'node',
      name: 'Radisson Blu Greater Noida',
      category: 'hotel',
      address: 'Site 4, Greater Noida',
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: '201308',
      latitude: 28.4721,
      longitude: 77.5022,
      phone: '0120 450 0000',
      email: 'reservations@radissongreaternoida.com',
      website: 'https://radissonhotels.com',
      rawTags: { 'addr:postcode': '201308' },
      capturedAt: new Date(),
    };

    const canonical = service.mergeIntoCanonical(googleCandidate, osmCandidate);

    expect(canonical.id).toBe('biz_ChIJ_test');
    expect(canonical.identity.name).toBe('Radisson Blu Hotel Greater Noida');
    expect(canonical.google?.rating).toBe(4.5);
    expect(canonical.google?.reviewCount).toBe(3200);
    // Preserved email from OSM
    expect(canonical.identity.email).toBe('reservations@radissongreaternoida.com');
    // Both sources tracked
    expect(canonical.sources).toHaveLength(2);
    expect(canonical.sources.map((s) => s.provider)).toEqual(['google_places', 'openstreetmap']);
    // Assert primary canonical source is explicitly GOOGLE_PLACES
    expect(canonical.source).toBe('GOOGLE_PLACES');
    // Field-level evidence generated
    expect(canonical.evidence.length).toBeGreaterThan(0);
  });
});
