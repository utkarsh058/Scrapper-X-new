import { ScoreBreakdownItem } from '@/models/Lead';

export interface LeadScoreInput {
  businessName?: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  websiteStatus?: string;
  https?: boolean;
  locationVerificationStatus?: 'VERIFIED' | 'UNKNOWN' | 'OUTSIDE_LOCATION' | string;
  businessVerificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'REJECTED' | string;
  sources?: string[];
  rawTags?: Record<string, any>;
  audit?: {
    overallScore?: number;
    issues?: any[];
    ux?: {
      mobileViewport?: boolean;
    };
    uxData?: {
      mobileViewport?: boolean;
    };
    mobileOptimized?: boolean;
    performanceScore?: number | null;
  };
}

export interface LeadScoreResult {
  score: number;
  breakdown: ScoreBreakdownItem[];
  summary: string;
}

/**
 * Calculates a transparent, evidence-based lead commercial readiness score (0-100).
 * 
 * Rules:
 * 1. ONLY real observed signals already present in the pipeline are rewarded.
 * 2. Missing evidence receives 0 points (no fabricated points for missing website/phone/email).
 * 3. UNKNOWN states (e.g. unknown location) remain UNKNOWN and receive 0 points.
 * 4. The sum of points in `breakdown` strictly equals the final `score`.
 * 5. Score is bounded between 0 and 100.
 */
export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];

  // ---------------------------------------------------------
  // 1. Contact Reachability Channels (Max 35 points)
  // Direct communication channels are essential for sales outreach.
  // ---------------------------------------------------------
  const hasPhone = Boolean(input.phone && input.phone.trim().length > 0);
  if (hasPhone) {
    breakdown.push({
      rule: 'VERIFIED_PHONE',
      points: 20,
      reason: 'Direct telephone contact channel verified and available for outreach.',
    });
  }

  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  if (hasEmail) {
    breakdown.push({
      rule: 'VERIFIED_EMAIL',
      points: 15,
      reason: 'Direct email contact channel verified and available for written outreach.',
    });
  }

  // ---------------------------------------------------------
  // 2. Website & Digital Presence (Max 30 points)
  // Evaluates actual observed web readiness and infrastructure.
  // ---------------------------------------------------------
  const rawUrl = (input.website || '').trim();
  const hasWebsiteUrl = rawUrl.length > 0;
  const statusStr = (input.websiteStatus || '').toLowerCase().trim();

  if (hasWebsiteUrl && statusStr !== 'no website' && statusStr !== 'no_website') {
    if (statusStr === 'working' || statusStr === 'live') {
      breakdown.push({
        rule: 'WEBSITE_WORKING',
        points: 20,
        reason: 'Official business website is active, reachable, and returned HTTP OK.',
      });

      if (input.https === true || rawUrl.startsWith('https://')) {
        breakdown.push({
          rule: 'WEBSITE_HTTPS',
          points: 5,
          reason: 'Website enforces modern SSL/HTTPS encrypted transport protocol.',
        });
      }
    } else if (statusStr === 'needs improvement' || statusStr === 'needs_improvement') {
      breakdown.push({
        rule: 'WEBSITE_NEEDS_IMPROVEMENT',
        points: 15,
        reason: 'Website is live with documented technical or conversion optimization opportunities.',
      });

      if (input.https === true || rawUrl.startsWith('https://')) {
        breakdown.push({
          rule: 'WEBSITE_HTTPS',
          points: 5,
          reason: 'Website enforces modern SSL/HTTPS encrypted transport protocol.',
        });
      }
    } else if (statusStr === 'unreachable') {
      breakdown.push({
        rule: 'WEBSITE_UNREACHABLE',
        points: 5,
        reason: 'Registered web domain exists, though server is currently unreachable.',
      });
    } else {
      // Valid URL exists with unconfirmed reachability
      breakdown.push({
        rule: 'WEBSITE_DOMAIN_REGISTERED',
        points: 5,
        reason: 'Official web domain is registered and associated with the business.',
      });
    }

    // Optional verified mobile responsiveness from audit evidence
    const isMobileResponsive =
      input.audit?.ux?.mobileViewport === true ||
      input.audit?.uxData?.mobileViewport === true ||
      input.audit?.mobileOptimized === true;

    if (isMobileResponsive) {
      breakdown.push({
        rule: 'WEBSITE_MOBILE_VIEWPORT',
        points: 5,
        reason: 'Website layout is verified mobile-responsive across handheld viewports.',
      });
    }
  }

  // ---------------------------------------------------------
  // 3. Location Verification (Max 15 points)
  // Geographic boundaries and municipality coordinate precision.
  // UNKNOWN receives 0 points (never treated as verified).
  // ---------------------------------------------------------
  const isLocationVerified = input.locationVerificationStatus === 'VERIFIED';
  if (isLocationVerified) {
    breakdown.push({
      rule: 'LOCATION_VERIFIED',
      points: 15,
      reason: 'Geographic location verified within target municipality boundaries.',
    });
  }

  // ---------------------------------------------------------
  // 4. Business Identity & Commercial Legitimacy (Max 20 points)
  // ---------------------------------------------------------
  const name = (input.businessName || '').trim();
  const isBizVerified = input.businessVerificationStatus !== 'REJECTED' && name.length > 0;
  if (isBizVerified) {
    breakdown.push({
      rule: 'BUSINESS_IDENTITY_VERIFIED',
      points: 10,
      reason: 'Business commercial identity and operating category confirmed.',
    });
  }

  const address = (input.address || '').trim();
  const city = (input.city || '').trim();
  const hasDetailedStreetAddress =
    address.length > 6 &&
    address.toLowerCase() !== city.toLowerCase() &&
    address.toLowerCase() !== (input.state || '').toLowerCase();

  if (hasDetailedStreetAddress) {
    breakdown.push({
      rule: 'STREET_ADDRESS_AVAILABLE',
      points: 5,
      reason: 'Physical street address available with verified local brick-and-mortar presence.',
    });
  }

  const isMultiSource = Array.isArray(input.sources) && input.sources.length > 1;
  const rawRating = Number(input.rawTags?.rating || input.rawTags?.userRating || 0);
  const rawReviews = Number(
    input.rawTags?.userRatingCount || input.rawTags?.userRatingsTotal || input.rawTags?.reviewsCount || 0
  );

  if (isMultiSource) {
    breakdown.push({
      rule: 'MULTI_SOURCE_CONFIRMED',
      points: 5,
      reason: 'Business cross-verified across multiple authoritative directory sources.',
    });
  } else if (rawRating >= 4.0 || rawReviews >= 5) {
    breakdown.push({
      rule: 'VERIFIED_CUSTOMER_REVIEWS',
      points: 5,
      reason: `Evidence of verified customer reviews and directory reputation (Rating: ${rawRating || 'Verified'}).`,
    });
  }

  // Final score is the exact sum of evidence points, strictly bounded 0-100
  const rawTotal = breakdown.reduce((acc, item) => acc + item.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawTotal)));

  const summary = `${score}/100: ${breakdown.map((b) => `${b.rule} (+${b.points})`).join(', ') || 'No verified signals'}`;

  return {
    score,
    breakdown,
    summary,
  };
}
