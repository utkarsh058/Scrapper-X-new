/**
 * Business Identity Resolution Service
 * 
 * Strict Single Responsibility:
 * Determines if multiple provider candidates represent the same real-world business entity.
 * 
 * Evidence used for matching:
 * 1. Google Place ID (exact match = 100% confidence)
 * 2. Normalized Phone match (high confidence = 95%)
 * 3. Normalized Website/Domain match (high confidence = 90%)
 * 4. Coordinate proximity (< 50 meters) + Name similarity (85%)
 * 5. Address match + Name similarity (80%)
 * 
 * Boundary Constraints:
 * - Does not call external APIs.
 * - Does not wipe out stronger Google information with weaker OSM data.
 * - Records match confidence and evidence flags.
 */

import { GoogleBusinessCandidate, OSMProfileCandidate, CanonicalBusiness, CanonicalBusinessIdentity, SourceEvidence } from '@/types/canonical';

export interface IdentityMatchEvidence {
  matched: boolean;
  confidence: number;
  evidence: string[];
}

export class BusinessIdentityResolutionService {
  /**
   * Normalizes a phone number for comparison (strips spaces, dashes, parentheses, +91/0 prefix for India)
   */
  public normalizePhone(phone?: string | null, countryCode?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    // For USA/Canada (+1): if 11 digits and starts with 1, strip 1
    if (countryCode === 'US' || countryCode === 'CA') {
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
      }
      return digits;
    }
    // Strip India country code prefix (91) or leading zero if 10-digit number follows
    if (digits.length > 10 && digits.startsWith('91')) {
      return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits;
  }

  /**
   * Normalizes a website URL to bare hostname/domain (e.g., "https://www.example.com/about" -> "example.com")
   */
  public normalizeDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
    } catch {
      return url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
    }
  }

  /**
   * Calculates Levenshtein-based similarity score (0 to 1) between two strings
   */
  public nameSimilarity(a: string, b: string): number {
    const s1 = a.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const s2 = b.toLowerCase().trim().replace(/[^\w\s]/g, '');
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    let distance = 0;
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    distance = costs[s2.length];
    return (longerLength - distance) / longerLength;
  }

  /**
   * Calculates distance in meters between two lat/lon coordinates (Haversine formula)
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Checks whether two candidates represent the same business entity
   */
  public matchCandidates(
    a: { name: string; phone?: string | null; website?: string | null; lat?: number | null; lon?: number | null; placeId?: string | null },
    b: { name: string; phone?: string | null; website?: string | null; lat?: number | null; lon?: number | null; placeId?: string | null }
  ): IdentityMatchEvidence {
    const evidence: string[] = [];
    let confidence = 0;

    // 1. Google Place ID
    if (a.placeId && b.placeId && a.placeId === b.placeId) {
      return { matched: true, confidence: 1.0, evidence: ['google_place_id_exact_match'] };
    }

    // 2. Phone match
    const phoneA = this.normalizePhone(a.phone);
    const phoneB = this.normalizePhone(b.phone);
    const phoneMatch = Boolean(phoneA && phoneB && phoneA === phoneB);
    if (phoneMatch) {
      evidence.push('phone_match');
      confidence = Math.max(confidence, 0.95);
    }

    // 3. Domain match
    const domainA = this.normalizeDomain(a.website);
    const domainB = this.normalizeDomain(b.website);
    const domainMatch = Boolean(domainA && domainB && domainA === domainB);
    if (domainMatch) {
      evidence.push('domain_match');
      confidence = Math.max(confidence, 0.90);
    }

    // 4. Name similarity
    const sim = this.nameSimilarity(a.name, b.name);
    if (sim >= 0.8) {
      evidence.push(`name_similarity_${Math.round(sim * 100)}%`);
    }

    // 5. Geographic proximity
    let geoMatch = false;
    if (
      typeof a.lat === 'number' &&
      typeof a.lon === 'number' &&
      typeof b.lat === 'number' &&
      typeof b.lon === 'number'
    ) {
      const dist = this.calculateDistanceMeters(a.lat, a.lon, b.lat, b.lon);
      if (dist <= 75) {
        evidence.push(`geo_proximity_${Math.round(dist)}m`);
        geoMatch = true;
      }
    }

    // Decision Logic
    if (phoneMatch && (sim >= 0.5 || domainMatch || geoMatch)) {
      return { matched: true, confidence: 0.95, evidence };
    }

    if (domainMatch && (sim >= 0.5 || geoMatch)) {
      return { matched: true, confidence: 0.92, evidence };
    }

    if (geoMatch && sim >= 0.75) {
      return { matched: true, confidence: 0.85, evidence };
    }

    if (sim >= 0.90 && (phoneMatch || domainMatch || geoMatch)) {
      return { matched: true, confidence: 0.88, evidence };
    }

    return { matched: false, confidence, evidence };
  }

  /**
   * Merges GoogleBusinessCandidate and OSMProfileCandidate into a single CanonicalBusiness
   */
  public mergeIntoCanonical(
    googleCandidate?: GoogleBusinessCandidate | null,
    osmCandidate?: OSMProfileCandidate | null
  ): CanonicalBusiness {
    if (!googleCandidate && !osmCandidate) {
      throw new Error('Cannot create canonical business without at least one provider candidate.');
    }

    const id = googleCandidate
      ? `biz_${googleCandidate.placeId}`
      : `biz_osm_${osmCandidate!.osmId}`;

    const evidence: SourceEvidence[] = [];
    const nowIso = new Date().toISOString();

    // Identity fields: Google takes precedence if present, falling back to OSM
    const name = (googleCandidate?.name || osmCandidate?.name || 'Unknown Business').trim();
    const category = googleCandidate?.category || osmCandidate?.category || 'Business';
    const address = googleCandidate?.address || osmCandidate?.address || null;
    const city = googleCandidate?.city || osmCandidate?.city || null;
    const state = googleCandidate?.state || osmCandidate?.state || null;
    const country = googleCandidate?.country || osmCandidate?.country || 'India';
    const countryCode =
      country === 'United States' || country === 'US' || country === 'USA'
        ? 'US'
        : country === 'Canada' || country === 'CA'
        ? 'CA'
        : 'IN';
    const postalCode = googleCandidate?.postalCode || osmCandidate?.postalCode || null;

    const latitude = googleCandidate?.latitude ?? osmCandidate?.latitude ?? null;
    const longitude = googleCandidate?.longitude ?? osmCandidate?.longitude ?? null;

    const phone = googleCandidate?.phone || osmCandidate?.phone || null;
    const website = googleCandidate?.website || osmCandidate?.website || null;
    const email = osmCandidate?.email || null;

    // Track provenance for primary fields
    if (googleCandidate) {
      if (googleCandidate.phone) {
        evidence.push({
          entityType: 'business',
          entityId: id,
          field: 'phone',
          value: googleCandidate.phone,
          source: 'google_places',
          capturedAt: nowIso,
          confidence: 'HIGH',
        });
      }
      if (googleCandidate.website) {
        evidence.push({
          entityType: 'business',
          entityId: id,
          field: 'website',
          value: googleCandidate.website,
          source: 'google_places',
          capturedAt: nowIso,
          confidence: 'HIGH',
        });
      }
      if (googleCandidate.rating !== null && googleCandidate.rating !== undefined) {
        evidence.push({
          entityType: 'review_summary',
          entityId: id,
          field: 'rating',
          value: String(googleCandidate.rating),
          source: 'google_places',
          capturedAt: nowIso,
          confidence: 'HIGH',
        });
      }
      if (googleCandidate.reviewCount !== null && googleCandidate.reviewCount !== undefined) {
        evidence.push({
          entityType: 'review_summary',
          entityId: id,
          field: 'reviewCount',
          value: String(googleCandidate.reviewCount),
          source: 'google_places',
          capturedAt: nowIso,
          confidence: 'HIGH',
        });
      }
    }

    if (osmCandidate) {
      if (osmCandidate.email) {
        evidence.push({
          entityType: 'contact',
          entityId: id,
          field: 'email',
          value: osmCandidate.email,
          source: 'openstreetmap',
          capturedAt: nowIso,
          confidence: 'HIGH',
        });
      }
      if (!googleCandidate?.phone && osmCandidate.phone) {
        evidence.push({
          entityType: 'business',
          entityId: id,
          field: 'phone',
          value: osmCandidate.phone,
          source: 'openstreetmap',
          capturedAt: nowIso,
          confidence: 'MEDIUM',
        });
      }
      if (!googleCandidate?.website && osmCandidate.website) {
        evidence.push({
          entityType: 'business',
          entityId: id,
          field: 'website',
          value: osmCandidate.website,
          source: 'openstreetmap',
          capturedAt: nowIso,
          confidence: 'MEDIUM',
        });
      }
    }

    const sources: CanonicalBusiness['sources'] = [];
    if (googleCandidate) {
      sources.push({
        provider: 'google_places',
        sourceId: googleCandidate.placeId,
        sourceUrl: googleCandidate.googleMapsUrl || undefined,
        collectedAt: googleCandidate.capturedAt,
      });
    }
    if (osmCandidate) {
      sources.push({
        provider: 'openstreetmap',
        sourceId: osmCandidate.osmId,
        sourceUrl: `https://www.openstreetmap.org/${osmCandidate.osmType}/${osmCandidate.osmId}`,
        collectedAt: osmCandidate.capturedAt,
      });
    }

    const identity: CanonicalBusinessIdentity = {
      name,
      category,
      address,
      city,
      state,
      country,
      countryCode,
      postalCode,
      latitude,
      longitude,
      phone,
      website,
      email,
    };

    const google = googleCandidate
      ? {
          placeId: googleCandidate.placeId,
          rating: googleCandidate.rating,
          reviewCount: googleCandidate.reviewCount,
          mapsUrl: googleCandidate.googleMapsUrl,
          businessStatus: googleCandidate.businessStatus,
          profileCreatedAt: null,
          profileCreatedAtType: 'NOT_AVAILABLE' as const,
          firstSeenAt: googleCandidate.capturedAt,
          lastCheckedAt: googleCandidate.capturedAt,
        }
      : undefined;

    return {
      id,
      source: googleCandidate ? 'GOOGLE_PLACES' : 'OPENSTREETMAP',
      identity,
      google,
      sources,
      social: [],
      eligibility: {
        included: true,
        excludedReason: null,
      },
      ranking: {},
      evidence,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export const businessIdentityResolutionService = new BusinessIdentityResolutionService();
