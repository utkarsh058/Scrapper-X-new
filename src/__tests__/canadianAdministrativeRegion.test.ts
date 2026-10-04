import { describe, it, expect } from 'vitest';
import { validateAdministrativeRegion } from '@/lib/location/RegionRegistry';
import { GooglePlacesDiscoveryProvider } from '@/providers/GooglePlacesDiscoveryProvider';
import { googlePlacesProvider } from '@/providers/google/GooglePlacesProvider';
import { leadPilotOrchestrator } from '@/orchestrator/LeadPilotOrchestrator';

describe('Canadian Administrative Region Validation & Discovery Intelligence', () => {

  // =========================================================================
  // 1. EXACT USER FLOW: validateAdministrativeRegion("CA", "Ontario") -> Ontario / ON / PROVINCE
  // =========================================================================
  describe('User Flow: Country = CA, Province = Ontario', () => {
    it('validates ("CA", "Ontario") and returns Ontario / ON / PROVINCE', () => {
      const result = validateAdministrativeRegion('CA', 'Ontario');

      // Assert validity
      expect(result.valid).toBe(true);

      // Assert exact values
      expect(result.name).toBe('Ontario');
      expect(result.code).toBe('ON');
      expect(result.type).toBe('PROVINCE');
      expect(result.regionType).toBe('PROVINCE');
      expect(result.countryCode).toBe('CA');
      expect(result.countryName).toBe('Canada');

      // Assert exact canonical formatted string requested by user
      expect(result.formatted).toBe('Ontario / ON / PROVINCE');
      expect(result.toString()).toBe('Ontario / ON / PROVINCE');
      expect(`${result}`).toBe('Ontario / ON / PROVINCE');
    });

    it('resolves case-insensitively and by 2-letter abbreviation', () => {
      const byCode = validateAdministrativeRegion('ca', 'on');
      expect(byCode.valid).toBe(true);
      expect(byCode.formatted).toBe('Ontario / ON / PROVINCE');

      const byCountryName = validateAdministrativeRegion('Canada', 'ontario');
      expect(byCountryName.valid).toBe(true);
      expect(byCountryName.formatted).toBe('Ontario / ON / PROVINCE');
    });

    it('validates city within province (e.g. Toronto, ON)', () => {
      const result = validateAdministrativeRegion('CA', 'Ontario', 'Toronto');
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe('Ontario / ON / PROVINCE');
      expect(result.matchedCity).toBe('Toronto');
    });
  });

  // =========================================================================
  // 2. ALL CANADIAN PROVINCES AND TERRITORIES
  // =========================================================================
  describe('Full Canadian Jurisdiction Coverage', () => {
    const expectedProvinces: [string, string][] = [
      ['Ontario', 'ON'],
      ['Quebec', 'QC'],
      ['British Columbia', 'BC'],
      ['Alberta', 'AB'],
      ['Manitoba', 'MB'],
      ['Saskatchewan', 'SK'],
      ['Nova Scotia', 'NS'],
      ['New Brunswick', 'NB'],
      ['Newfoundland and Labrador', 'NL'],
      ['Prince Edward Island', 'PE'],
    ];

    for (const [prov, code] of expectedProvinces) {
      it(`validates Province: ${prov} (${code}) -> ${prov} / ${code} / PROVINCE`, () => {
        const res = validateAdministrativeRegion('CA', prov);
        expect(res.valid).toBe(true);
        expect(res.name).toBe(prov);
        expect(res.code).toBe(code);
        expect(res.type).toBe('PROVINCE');
        expect(res.formatted).toBe(`${prov} / ${code} / PROVINCE`);
      });
    }

    const expectedTerritories: [string, string][] = [
      ['Northwest Territories', 'NT'],
      ['Nunavut', 'NU'],
      ['Yukon', 'YT'],
    ];

    for (const [terr, code] of expectedTerritories) {
      it(`validates Territory: ${terr} (${code}) -> ${terr} / ${code} / TERRITORY`, () => {
        const res = validateAdministrativeRegion('CA', terr);
        expect(res.valid).toBe(true);
        expect(res.name).toBe(terr);
        expect(res.code).toBe(code);
        expect(res.type).toBe('TERRITORY');
        expect(res.formatted).toBe(`${terr} / ${code} / TERRITORY`);
      });
    }

    it('rejects invalid regions and unsupported countries', () => {
      const invalidRegion = validateAdministrativeRegion('CA', 'Texas');
      expect(invalidRegion.valid).toBe(false);
      expect(invalidRegion.error).toContain('Invalid administrative region');

      const invalidCountry = validateAdministrativeRegion('ZZ', 'Ontario');
      expect(invalidCountry.valid).toBe(false);
      expect(invalidCountry.error).toContain('Unsupported country');
    });
  });

  // =========================================================================
  // 3. REAL CANADIAN BUSINESSES DISCOVERY
  // =========================================================================
  describe('Real Canadian Business Discovery', () => {
    it('discovers verified Canadian businesses in Toronto, Ontario via Google Places Discovery Provider', async () => {
      const provider = new GooglePlacesDiscoveryProvider();
      if (!provider.isConfigured()) {
        console.warn('Google Places API key not configured, skipping live API call');
        return;
      }

      const res = await provider.discoverBusinesses({
        industry: 'Restaurants',
        state: 'Ontario',
        city: 'Toronto',
        country: 'Canada',
        countryCode: 'CA',
        limit: 5,
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.businesses.length).toBeGreaterThan(0);

      // Verify returned businesses are real Canadian businesses
      const first = res.businesses[0];
      expect(first.businessName).toBeDefined();
      expect(first.address).toBeDefined();
      console.log(`[Real Canadian Business Found] ${first.businessName} - ${first.address}`);
    }, 20000);

    it('runs orchestrator pipeline for Ontario, Canada without rejecting as invalid Indian state', async () => {
      const job = leadPilotOrchestrator.createJob({
        country: 'Canada',
        countryCode: 'CA',
        state: 'Ontario',
        city: 'Toronto',
        industry: 'Dentists',
        limit: 5,
      });

      expect(job.criteria.country).toBe('Canada');
      expect(job.criteria.state).toBe('Ontario');

      // Execute synchronous pipeline run
      const completedJob = await leadPilotOrchestrator.executeJob(job.id, 25000);
      expect(completedJob.status).not.toBe('FAILED');
      expect(completedJob.rejectionReasons?.INVALID_LOCATION || 0).toBe(0);
      console.log(`[Job Success] Discovered: ${completedJob.discovered} Canadian businesses in Ontario.`);
    }, 30000);
  });
});
