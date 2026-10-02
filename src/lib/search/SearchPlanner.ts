import { RawDiscoveredBusiness } from '@/providers/BusinessDiscoveryProvider';

export type ContactFilter =
  | 'All Contacts'
  | 'Phone or Email'
  | 'Has Phone or Email'
  | 'Phone Only'
  | 'Email Only'
  | 'Email + Phone'
  | 'Email and Phone'
  | 'No Contact';

export type WebsiteFilter =
  | 'Any Website'
  | 'Website Available'
  | 'No Website'
  | 'Working Website'
  | 'Needs Improvement'
  | 'Unreachable';

export interface PlannedFilters {
  fastFilters: {
    categoryMatch: boolean;
    locationMatch: boolean;
    requirePhone: boolean;
    requireWebsite: boolean;
    forbidWebsite: boolean;
  };
  enrichmentFilters: {
    requireEmailExtraction: boolean;
    requireWebsiteDiscovery: boolean;
    requireReachabilityCheck: boolean;
  };
  deepAuditFilters: {
    requireSeoAudit: boolean;
    requirePageSpeed: boolean;
    requireUxAudit: boolean;
  };
  strictVerificationRequired: boolean;
  strictFilterReason?: 'EMAIL_REQUIRED' | 'NO_WEBSITE_VERIFICATION_REQUIRED' | 'AUDIT_REQUIRED';
}

export interface DiscoveryExecutionPlan {
  primaryProvider: 'google_places' | 'cache' | 'osm';
  executeOsmSecondary: boolean;
  osmReason?: 'FALLBACK' | 'SUPPLEMENTAL' | 'NOT_NEEDED';
  plannedFilters: PlannedFilters;
  canPassCheaply: (business: RawDiscoveredBusiness) => { passed: boolean; needsBackgroundEnrichment: boolean; reason?: string };
}

export class SearchPlanner {
  /**
   * Plans the discovery and filtration pipeline based on criteria.
   */
  public planSearch(params: {
    industry: string;
    state: string;
    city?: string;
    contactFilter?: string;
    websiteFilter?: string;
    limit: number;
    isGoogleConfigured: boolean;
    isGoogleCircuitOpen: boolean;
    isGoogleBudgetAllowed: boolean;
  }): DiscoveryExecutionPlan {
    const contactFilter = (params.contactFilter || 'All Contacts') as ContactFilter;
    const websiteFilter = (params.websiteFilter || 'Any Website') as WebsiteFilter;

    // 1. Analyze Contact Filter requirements
    const normContact = contactFilter.toUpperCase().replace(/\s+/g, '_');
    const requirePhone =
      normContact === 'PHONE_ONLY' ||
      normContact === 'PHONE_OR_EMAIL' ||
      normContact === 'HAS_PHONE_OR_EMAIL' ||
      normContact === 'EMAIL_+_PHONE' ||
      normContact === 'EMAIL_AND_PHONE';

    const requireEmail =
      normContact === 'EMAIL_ONLY' ||
      normContact === 'EMAIL_+_PHONE' ||
      normContact === 'EMAIL_AND_PHONE';

    // 2. Analyze Website Filter requirements
    const normWebsite = websiteFilter.toUpperCase().replace(/\s+/g, '_');
    const requireWebsite = normWebsite === 'WEBSITE_AVAILABLE' || normWebsite === 'WORKING_WEBSITE';
    const forbidWebsite = normWebsite === 'NO_WEBSITE';
    const requireAudit = normWebsite === 'NEEDS_IMPROVEMENT';
    const requireReachability = normWebsite === 'UNREACHABLE' || requireWebsite || forbidWebsite;

    const strictVerificationRequired = requireEmail || forbidWebsite || requireAudit;
    let strictFilterReason: 'EMAIL_REQUIRED' | 'NO_WEBSITE_VERIFICATION_REQUIRED' | 'AUDIT_REQUIRED' | undefined;
    if (requireEmail) strictFilterReason = 'EMAIL_REQUIRED';
    else if (forbidWebsite) strictFilterReason = 'NO_WEBSITE_VERIFICATION_REQUIRED';
    else if (requireAudit) strictFilterReason = 'AUDIT_REQUIRED';

    const plannedFilters: PlannedFilters = {
      fastFilters: {
        categoryMatch: true,
        locationMatch: true,
        requirePhone: normContact === 'PHONE_ONLY',
        requireWebsite,
        forbidWebsite,
      },
      enrichmentFilters: {
        requireEmailExtraction: requireEmail || normContact === 'PHONE_OR_EMAIL' || normContact === 'HAS_PHONE_OR_EMAIL',
        requireWebsiteDiscovery: !forbidWebsite,
        requireReachabilityCheck: requireReachability,
      },
      deepAuditFilters: {
        requireSeoAudit: requireAudit,
        requirePageSpeed: requireAudit,
        requireUxAudit: requireAudit,
      },
      strictVerificationRequired,
      strictFilterReason,
    };

    // 3. Determine Discovery Strategy (Google Primary vs OSM)
    const canUseGoogle =
      params.isGoogleConfigured && !params.isGoogleCircuitOpen && params.isGoogleBudgetAllowed;

    let primaryProvider: 'google_places' | 'cache' | 'osm' = canUseGoogle ? 'google_places' : 'osm';
    let executeOsmSecondary = !canUseGoogle;
    let osmReason: 'FALLBACK' | 'SUPPLEMENTAL' | 'NOT_NEEDED' = canUseGoogle ? 'NOT_NEEDED' : 'FALLBACK';

    // 4. Fast cheap qualification evaluator
    const canPassCheaply = (b: RawDiscoveredBusiness) => {
      const hasPhone = Boolean(b.phone && b.phone.trim().length > 0);
      const hasEmail = Boolean(b.email && b.email.trim().length > 0);
      const hasWebsite = Boolean(b.website && b.website.trim().length > 0);

      // Check contact
      if (normContact === 'ALL_CONTACTS') {
        // Fast pass!
      } else if (normContact === 'PHONE_ONLY') {
        if (!hasPhone) return { passed: false, needsBackgroundEnrichment: true, reason: 'PHONE_MISSING' };
      } else if (normContact === 'PHONE_OR_EMAIL' || normContact === 'HAS_PHONE_OR_EMAIL') {
        if (hasPhone || hasEmail) {
          // Has phone or email already! Pass immediately without blocking!
        } else {
          return { passed: false, needsBackgroundEnrichment: Boolean(hasWebsite), reason: 'NO_CONTACT' };
        }
      } else if (normContact === 'EMAIL_ONLY') {
        if (hasEmail) {
          // Has email already!
        } else {
          return { passed: false, needsBackgroundEnrichment: true, reason: 'EMAIL_ENRICHMENT_REQUIRED' };
        }
      } else if (normContact === 'EMAIL_+_PHONE' || normContact === 'EMAIL_AND_PHONE') {
        if (hasPhone && hasEmail) {
          // Both already present!
        } else {
          return { passed: false, needsBackgroundEnrichment: true, reason: 'EMAIL_OR_PHONE_MISSING' };
        }
      }

      // Check website
      if (normWebsite === 'ANY_WEBSITE' || normWebsite === 'ANY' || normWebsite === 'ALL_WEBSITES') {
        // Fast pass!
      } else if (normWebsite === 'NO_WEBSITE') {
        if (hasWebsite) {
          return { passed: false, needsBackgroundEnrichment: false, reason: 'HAS_WEBSITE' };
        }
        return { passed: true, needsBackgroundEnrichment: false };
      } else if (normWebsite === 'WORKING' || normWebsite === 'WEBSITE_AVAILABLE' || normWebsite === 'WORKING_WEBSITE') {
        if (!hasWebsite) {
          return { passed: false, needsBackgroundEnrichment: false, reason: 'NO_WEBSITE' };
        }
      } else if (normWebsite === 'UNREACHABLE' || normWebsite === 'WEBSITE_UNREACHABLE') {
        if (!hasWebsite) {
          return { passed: false, needsBackgroundEnrichment: false, reason: 'NO_WEBSITE' };
        }
      } else if (normWebsite === 'NEEDS_IMPROVEMENT' || normWebsite === 'NEEDS_WEBSITE_IMPROVEMENT') {
        if (!hasWebsite) {
          return { passed: false, needsBackgroundEnrichment: false, reason: 'NO_WEBSITE' };
        }
      }

      return { passed: true, needsBackgroundEnrichment: false };
    };

    return {
      primaryProvider,
      executeOsmSecondary,
      osmReason,
      plannedFilters,
      canPassCheaply,
    };
  }
}

export const searchPlanner = new SearchPlanner();
