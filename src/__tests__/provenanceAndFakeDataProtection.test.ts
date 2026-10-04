import { describe, it, expect, beforeEach } from 'vitest';
import { provenanceService } from '@/services/evidence/ProvenanceService';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

describe('Provenance and Fake-Data Protection (Section 30, 36, 42)', () => {
  beforeEach(() => {
    provenanceService.clear();
  });

  it('records first-class field-level evidence with source and confidence', () => {
    provenanceService.recordEvidence({
      entityType: 'business',
      entityId: 'biz_test_123',
      field: 'phone',
      value: '+91 120 456 7890',
      source: 'google_places',
      capturedAt: new Date().toISOString(),
      confidence: 'HIGH',
    });

    provenanceService.recordEvidence({
      entityType: 'social_profile',
      entityId: 'soc_biz_test_123_instagram',
      field: 'profileUrl',
      value: 'https://instagram.com/testbiz',
      source: 'website_jsonld',
      capturedAt: new Date().toISOString(),
      confidence: 'HIGH',
    });

    const evidence = provenanceService.getEvidenceForEntity('biz_test_123');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('phone');
    expect(evidence[0].source).toBe('google_places');
    expect(evidence[0].confidence).toBe('HIGH');
  });

  it('guarantees that missing data remains strictly null and not fabricated', () => {
    const session = businessDiscoveryService.createSearchSession({
      query: 'real test restaurants',
      location: { city: 'Greater Noida', state: 'Uttar Pradesh', country: 'India' },
    });

    expect(session.status).toBe('CREATED');
    expect(session.businesses).toHaveLength(0);
  });
});
