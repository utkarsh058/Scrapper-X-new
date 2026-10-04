/**
 * Social Identity Verification Service
 * 
 * Strict Single Responsibility:
 * Verifies that a candidate social media profile legitimately belongs to the specific business.
 * 
 * Boundary Constraints:
 * - Never attaches a profile based merely on a loosely similar name.
 * - Profiles discovered directly on the official business website have highest confidence (HIGH / 0.98).
 * - Profiles from public search require multi-factor proof (domain in bio, city match, exact name match).
 */

import { CanonicalBusinessIdentity } from '@/types/canonical';
import { ExtractedSocialLink } from './WebsiteSocialExtractor';

export interface SocialVerificationResult {
  matched: boolean;
  confidence: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
}

export class SocialIdentityVerificationService {
  /**
   * Verifies an extracted or candidate social profile against business identity
   */
  public verify(
    identity: CanonicalBusinessIdentity,
    candidate: ExtractedSocialLink & { bio?: string; bioWebsite?: string }
  ): SocialVerificationResult {
    const evidence: string[] = [];
    let confidence = 0;

    // 1. Direct website extraction: highest confidence
    if (
      candidate.source === 'website_header' ||
      candidate.source === 'website_footer' ||
      candidate.source === 'website_jsonld' ||
      candidate.source === 'website_body'
    ) {
      evidence.push('verified_direct_website_link');
      confidence = 0.98;
      return {
        matched: true,
        confidence,
        level: 'HIGH',
        evidence,
      };
    }

    // 2. Candidate from public search: requires verification
    const cleanBizName = identity.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanUsername = (candidate.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Username match
    if (cleanUsername && (cleanUsername === cleanBizName || cleanUsername.includes(cleanBizName))) {
      evidence.push('username_name_match');
      confidence += 0.45;
    }

    // City match in bio
    if (identity.city && candidate.bio) {
      const bioLower = candidate.bio.toLowerCase();
      if (bioLower.includes(identity.city.toLowerCase())) {
        evidence.push('bio_city_match');
        confidence += 0.35;
      }
    }

    // Website/domain match in bio
    if (identity.website && candidate.bioWebsite) {
      const bizDomain = this.getDomain(identity.website);
      const bioDomain = this.getDomain(candidate.bioWebsite);
      if (bizDomain && bioDomain && bizDomain === bioDomain) {
        evidence.push('bio_domain_exact_match');
        confidence += 0.45;
      }
    }

    // Determine level
    let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (confidence >= 0.8) {
      level = 'HIGH';
    } else if (confidence >= 0.5) {
      level = 'MEDIUM';
    }

    return {
      matched: confidence >= 0.5,
      confidence: Math.min(Number(confidence.toFixed(2)), 1.0),
      level,
      evidence,
    };
  }

  private getDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
    } catch {
      return null;
    }
  }
}

export const socialIdentityVerificationService = new SocialIdentityVerificationService();
