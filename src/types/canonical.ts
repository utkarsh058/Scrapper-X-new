/**
 * Canonical Data Contracts for LeadPilot
 * 
 * Strict architectural rule:
 * Raw provider structures must NEVER leak directly to the frontend or final Lead records.
 * Everything passes through normalization into these canonical types.
 */

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'linkedin'
  | 'tiktok'
  | 'twitter'
  | 'pinterest'
  | 'threads'
  | 'whatsapp_business'
  | 'other';

export type CreationDateType = 'OFFICIAL_API' | 'EXACT' | 'INFERRED' | 'NOT_AVAILABLE';

export type AccountCreatedStatus =
  | 'VERIFIED_EXACT'
  | 'VERIFIED_MONTH'
  | 'VERIFIED_YEAR'
  | 'FIRST_OBSERVED_ONLY'
  | 'NOT_AVAILABLE'
  | 'CONFLICT';

export type AccountCreatedDatePrecision = 'DAY' | 'MONTH' | 'YEAR';

export type AccountCreatedConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type AccountCreatedSourceType =
  | 'PUBLIC_PROFILE'
  | 'SEARCH_ENGINE'
  | 'PUBLIC_ARCHIVE'
  | 'NONE';


export type ProviderStatus =
  | 'SUCCESS'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'NOT_AVAILABLE';

export type PipelineStatus =
  | 'CREATED'
  | 'DISCOVERING'
  | 'ENRICHING'
  | 'DEDUPLICATING'
  | 'FILTERING'
  | 'SOCIAL_DISCOVERY'
  | 'SOCIAL_VERIFICATION'
  | 'RANKING'
  | 'READY'
  | 'PARTIAL'
  | 'FAILED';

export interface GoogleBusinessCandidate {
  externalId: string;
  source: 'google_places';
  placeId: string;

  name: string | null;
  category: string | null;
  categories: string[];

  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;

  latitude: number | null;
  longitude: number | null;

  phone: string | null;
  internationalPhone: string | null;

  website: string | null;
  googleMapsUrl: string | null;

  businessStatus: string | null;

  rating: number | null;
  reviewCount: number | null;

  openingHours: unknown | null;

  capturedAt: Date;
  rawPayload?: Record<string, any>;
}

export interface GoogleBusinessDetails extends GoogleBusinessCandidate {
  reviews?: Array<{
    authorName?: string;
    rating: number;
    text?: string;
    publishTime?: Date;
  }>;
}

export interface OSMProfileCandidate {
  externalId: string;
  source: 'openstreetmap';
  osmId: string;
  osmType: 'node' | 'way' | 'relation';

  name: string | null;
  category: string | null;

  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;

  latitude: number | null;
  longitude: number | null;

  phone: string | null;
  email: string | null;
  website: string | null;

  openingHours?: string | null;
  rawTags: Record<string, string>;
  capturedAt: Date;
}

export interface ReviewSummary {
  rating: number | null;
  reviewCount: number | null;
  reviewLevelDataAvailable: boolean;
  earliestAvailableReviewDate: Date | null;
  source: string;
  capturedAt: Date;
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export type SocialMetricStatus =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'PROFILE_NOT_FOUND';

export type MetricSourceType =
  | 'OFFICIAL_API'
  | 'PUBLIC_WEB'
  | 'WEBSITE_METADATA'
  | 'NONE';

export type SocialVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'REJECTED';

export interface SocialProfile {
  id: string;
  businessId: string;
  platform: SocialPlatform;

  profileUrl: string | null;
  username: string | null;
  displayName: string | null;
  description: string | null;

  followers: number | null;
  displayFollowerCount?: string | null;
  isRounded?: boolean | null;
  following: number | null;
  posts: number | null;
  subscribers: number | null;
  videos: number | null;
  likes: number | null;

  verified: boolean | null;

  createdAt: Date | null;
  createdAtType: CreationDateType;

  firstSeenAt: Date | null;
  lastActivityAt: Date | null;

  source: string; // website_header, website_footer, website_jsonld, official_api
  confidence: number | null;
  createdAtSource: string | null;

  metricStatus: SocialMetricStatus;
  metricSource: string | null;
  metricSourceType: MetricSourceType;
  followersFetchedAt: Date | null;
  verificationStatus: SocialVerificationStatus;

  // Real Social Account Creation Date Enrichment V2
  accountCreatedAt?: Date | null;
  accountCreatedDatePrecision?: AccountCreatedDatePrecision | null;
  accountCreatedConfidence?: AccountCreatedConfidence | null;
  accountCreatedStatus?: AccountCreatedStatus;
  accountCreatedSourceType?: AccountCreatedSourceType | null;
  accountCreatedSourceUrl?: string | null;
  accountCreatedEvidenceText?: string | null;
  accountCreatedFetchedAt?: Date | null;
  firstObservedAt?: Date | null;
  firstObservedSourceType?: string | null;
  firstObservedSourceUrl?: string | null;
  firstObservedEvidenceText?: string | null;
  earliestPublicPostAt?: Date | null;
  earliestPublicPostSourceUrl?: string | null;

  lastCheckedAt: Date;
}

export interface SocialProfileSnapshot {
  id: string;
  profileId: string;
  followers: number | null;
  displayFollowerCount?: string | null;
  isRounded?: boolean | null;
  following: number | null;
  posts: number | null;
  subscribers: number | null;
  videos: number | null;
  likes: number | null;
  isVerified?: boolean | null;
  metricStatus: SocialMetricStatus;
  metricSourceType: MetricSourceType;
  accountCreatedAt?: Date | null;
  accountCreatedAtType?: CreationDateType;

  // Real Social Account Creation Date Enrichment V2
  accountCreatedDatePrecision?: AccountCreatedDatePrecision | null;
  accountCreatedConfidence?: AccountCreatedConfidence | null;
  accountCreatedStatus?: AccountCreatedStatus;
  accountCreatedSourceType?: AccountCreatedSourceType | null;
  accountCreatedSourceUrl?: string | null;
  accountCreatedEvidenceText?: string | null;
  accountCreatedFetchedAt?: Date | null;
  firstObservedAt?: Date | null;
  firstObservedSourceType?: string | null;
  firstObservedSourceUrl?: string | null;
  firstObservedEvidenceText?: string | null;
  earliestPublicPostAt?: Date | null;
  earliestPublicPostSourceUrl?: string | null;

  capturedAt: Date;
  source: string;
}

export interface SourceEvidence {
  id?: string;
  entityType: 'business' | 'contact' | 'social_profile' | 'review_summary';
  entityId: string;
  field: string;
  value: string;
  source: string;
  capturedAt: string; // ISO date
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  metadata?: Record<string, any>;
}

export interface CanonicalBusinessIdentity {
  name: string;
  category: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: 'IN' | 'US' | 'CA' | string | null;
  regionCode?: string | null;
  timezone?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
}

export interface CanonicalBusiness {
  id: string;
  tenantId?: string | null;
  source: 'GOOGLE_PLACES' | 'OPENSTREETMAP';
  identity: CanonicalBusinessIdentity;

  google?: {
    placeId: string;
    rating: number | null;
    reviewCount: number | null;
    mapsUrl: string | null;
    businessStatus?: string | null;
    profileCreatedAt: Date | null;
    profileCreatedAtType: CreationDateType;
    firstSeenAt: Date | null;
    lastCheckedAt: Date;
  };

  sources: Array<{
    provider: string;
    sourceId: string;
    sourceUrl?: string;
    collectedAt: Date;
  }>;

  social: SocialProfile[];

  reviews?: {
    summary: ReviewSummary;
    items?: Array<{
      authorName?: string;
      rating: number;
      text?: string;
      publishTime?: Date;
    }>;
  };

  websiteAnalysis?: {
    url?: string;
    status: 'Working' | 'Needs Improvement' | 'Unreachable' | 'No Website';
    isHttps: boolean;
    detectedIssues: string[];
    speedScore?: number | null;
    mobileOptimized?: boolean;
    analyzedAt: Date;
  };

  eligibility: {
    included: boolean;
    excludedReason: string | null;
  };

  ranking: {
    reviewCountRank?: number;
    ratingRank?: number;
    overallRank?: number;
    score?: number;
  };

  evidence: SourceEvidence[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchFilters {
  excludePerfectRating?: boolean; // Default true: exclude rating === 5.0
  minReviews?: number;
  maxReviews?: number;
  minRating?: number;
  maxRating?: number;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  hasEmail?: boolean;
  hasInstagram?: boolean;
  hasFacebook?: boolean;
  hasYouTube?: boolean;
  hasLinkedIn?: boolean;
  hasTikTok?: boolean;
  hasAnySocial?: boolean;
  socialActivity?: 'RECENT' | 'ANY';
  contactFilter?: string;
  websiteFilter?: string;
}

export interface SearchSort {
  field: 'reviewCount' | 'rating' | 'leadScore' | 'name';
  direction: 'asc' | 'desc';
}

export interface SearchLocation {
  city: string;
  state: string;
  country: string;
  countryCode?: 'IN' | 'US' | 'CA' | string;
  regionCode?: string | null;
  regionName?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}

export interface SearchRequest {
  searchId?: string;
  tenantId?: string;
  userId?: string;
  query: string; // e.g. "restaurants"
  location: SearchLocation;
  filters?: SearchFilters;
  sort?: SearchSort;
  page?: number;
  limit?: number;
}

export interface SearchProgress {
  discovered: number;
  processed: number;
  completed: number;
  failed: number;
  stepMessage?: string;
}

export interface SearchStatusResponse {
  searchId: string;
  status: PipelineStatus;
  progress: SearchProgress;
  providerStatuses?: {
    googlePlaces: ProviderStatus;
    osm: ProviderStatus | 'DISABLED';
  };
  persistenceStatus?: 'PERSISTED' | 'NOT_CONFIGURED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface SearchReconciliation {
  requestedCount: number;
  rawDiscovered: number;
  googleDiscovered: number;
  secondaryDiscovered: number;
  duplicates: number;
  deduplicated: number;
  excluded5Star: number;
  eligible: number;
  persisted: number;
  failed: number;
}

export interface SearchResultsResponse {
  searchId: string;
  status: PipelineStatus;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  providerStatuses?: {
    googlePlaces: ProviderStatus;
    osm: ProviderStatus | 'DISABLED';
  };
  persistenceStatus?: 'PERSISTED' | 'NOT_CONFIGURED' | 'FAILED';
  filtersApplied: SearchFilters;
  sortApplied: SearchSort;
  reconciliation?: SearchReconciliation;
  summary: {
    totalDiscovered: number;
    googleBusinessesDiscovered: number;
    secondaryBusinessesDiscovered: number;
    totalUniqueBusinesses: number;
    fiveStarExcluded: number;
    eligibleBusinesses: number;
    googleEligibleBusinesses: number;
    totalEligible: number;
    totalExcluded5Star: number;
    withWebsite: number;
    withPhone: number;
    withEmail: number;
    withInstagram: number;
    withFacebook: number;
    withYouTube: number;
    withLinkedIn: number;
    withAnySocial: number;
  };
  results: CanonicalBusiness[];
}
