import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { googlePlacesProvider } from '@/providers/google/GooglePlacesProvider';
import { providerDiagnosticsService } from '@/services/diagnostics/ProviderDiagnostics';
import { businessRepository } from '@/services/persistence/BusinessRepository';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

describe('Google API Diagnostics, Provider Isolation & Persistence Contracts', () => {
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalKey) process.env.GOOGLE_PLACES_API_KEY = originalKey;
    else delete process.env.GOOGLE_PLACES_API_KEY;

    if (originalMapsKey) process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    else delete process.env.GOOGLE_MAPS_API_KEY;

    if (originalDb) process.env.DATABASE_URL = originalDb;
    else delete process.env.DATABASE_URL;
  });

  it('reports NOT_CONFIGURED when GOOGLE_PLACES_API_KEY is missing, without revealing secrets', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const diagnostics = await providerDiagnosticsService.getDiagnostics();

    expect(diagnostics.googlePlaces.status).toBe('NOT_CONFIGURED');
    expect(diagnostics.googlePlaces.hasKey).toBe(false);
    expect(diagnostics.googlePlaces.details).toContain('Missing GOOGLE_PLACES_API_KEY');
    // Ensure no secrets are present in diagnostics
    expect(JSON.stringify(diagnostics)).not.toMatch(/AIza[0-9A-Za-z-_]{35}/);
  });

  it('GooglePlacesProvider returns structured NOT_CONFIGURED status instead of throwing or generating fake data', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const res = await googlePlacesProvider.searchBusinesses({
      query: 'Restaurant',
      state: 'Uttar Pradesh',
    });

    expect(res.status).toBe('NOT_CONFIGURED');
    expect(res.candidates).toHaveLength(0);
    expect(res.error).toContain('GOOGLE_PLACES_NOT_CONFIGURED');
  });

  it('exposes explicit database persistence status (never silently claims persistent storage)', async () => {
    delete process.env.DATABASE_URL;

    const isConfigured = businessRepository.isDatabaseConfigured();
    expect(isConfigured).toBe(false);

    const check = await businessRepository.checkConnection();
    expect(check.connected).toBe(false);
    expect(check.error).toContain('DATABASE_URL is not set');

    const persistResult = await businessRepository.persistCanonicalBusiness({
      id: 'biz_sample',
      source: 'GOOGLE_PLACES',
      identity: { name: 'Sample', category: 'Restaurant' },
      sources: [],
      social: [],
      eligibility: { included: true, excludedReason: null },
      ranking: {},
      evidence: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(persistResult.status).toBe('NOT_CONFIGURED');
    expect(persistResult.error).toContain('DATABASE_NOT_CONFIGURED');
  });

  it('never labels OSM data as Google Places data', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const session = businessDiscoveryService.createSearchSession({
      query: 'Restaurant',
      location: { city: 'Greater Noida', state: 'Uttar Pradesh', country: 'India' },
    });

    const completed = await businessDiscoveryService.executeSearch(session.searchId);

    expect(completed.providerStatuses?.googlePlaces).toBe('NOT_CONFIGURED');
    for (const b of completed.businesses) {
      if (!b.google) {
        // Must be explicitly openstreetmap
        expect(b.source).toBe('OPENSTREETMAP');
        expect(b.google).toBeUndefined();
      }
    }
  });
});
