export type WebsiteStatus = 
  | 'No Website' 
  | 'NO_WEBSITE'
  | 'Working'
  | 'WORKING'
  | 'Needs Improvement'
  | 'NEEDS_IMPROVEMENT'
  | 'Unreachable'
  | 'UNREACHABLE'
  | 'Needs Website Improvement'
  | 'Website Available'
  | 'Website Unreachable'
  | 'Mobile Issues'
  | 'Slow Website'
  | 'Broken / Incomplete';

export type ContactFilter = 
  | 'Any Contact'
  | 'All Contacts'
  | 'Email + Phone'
  | 'Email Only'
  | 'Phone Only'
  | 'No Contact'
  | 'Has Phone or Email'
  | 'Phone or Email'
  | 'Has Email'
  | 'Has Phone';

export type WebsiteFilter =
  | 'Any Website'
  | 'All Websites'
  | 'No Website'
  | 'Website Available'
  | 'Working'
  | 'Needs Improvement'
  | 'Unreachable'
  | 'Needs Website Improvement'
  | 'Website Unreachable';

export type NumberOfLeads = 25 | 50 | 100 | 250 | 500 | 1000;

export interface StructuredWebsiteAudit {
  technical: {
    reachable: boolean;
    httpStatus?: number;
    https: boolean;
    responseTimeMs?: number;
    redirectCount?: number;
    brokenLinks?: string[];
  };
  mobile: {
    viewportConfigured: boolean;
    responsiveIndicators: boolean;
    issues: string[];
  };
  seo: {
    title?: string;
    hasTitle: boolean;
    metaDescription?: string;
    hasMetaDescription: boolean;
    hasH1: boolean;
    issues: string[];
  };
  conversion: {
    hasPhoneCta: boolean;
    hasEmailCta: boolean;
    hasContactForm: boolean;
    hasWhatsappLink: boolean;
    hasBookingLink: boolean;
    hasClearCta: boolean;
    issues: string[];
  };
  trust: {
    hasAboutPage: boolean;
    hasServicesPage: boolean;
    hasSocialLinks: boolean;
    socialLinks: string[];
  };
  performance?: {
    speedScore?: number;
    accessibilityScore?: number;
    seoScore?: number;
  };
  detectedIssues: string[];
  crawledPagesCount: number;
  deepCrawlAvailable: boolean;
  auditedAt: string;
}

export interface SearchSummary {
  total: number;
  withPhone: number;
  withEmail: number;
  emailAndPhone: number;
  hasPhoneOrEmail: number;
  noContact: number;
  noWebsite: number;
  websiteAvailable: number;
  workingWebsite: number;
  needsImprovement: number;
  unreachable: number;
}

export type SearchStatusType = 'COMPLETE' | 'PARTIAL' | 'NO_RESULTS' | 'FAILED';

export interface PipelineStats {
  rawOsmCount: number;
  namedCount: number;
  inCityBoundsCount: number;
  deduplicatedCount: number;
  withPhoneCount: number;
  withEmailCount: number;
  withWebsiteCount: number;
  contactFilteredCount: number;
  websiteFilteredCount: number;
  finalDeliveredCount: number;
  requestedLimit: number;
}

export interface SearchDiagnostics {
  searchStatus: SearchStatusType;
  sourceComplete: boolean;
  statusReason?: string;
  pipelineStats: PipelineStats;
  discardedBreakdown: {
    noName: number;
    outsideCity: number;
    duplicate: number;
    contactFilterExcluded: number;
    websiteFilterExcluded: number;
  };
  meta: {
    industry: string;
    state: string;
    city?: string;
    osmAreaResolved?: string;
    queryDurationMs: number;
    overpassEndpoint?: string;
  };
}

export interface ProviderStats {
  osm: { rawCount: number; status: string; durationMs: number; errors?: string[] };
  web: { rawCount: number; status: string; durationMs: number; errors?: string[] };
  webSearch?: { rawCount: number; status: string; durationMs: number; errors?: string[] };
  businessProvider?: { rawCount: number; status: string; durationMs: number; errors?: string[] };
  directory?: { rawCount: number; status: string; durationMs: number; errors?: string[] };
}

export interface PipelineBreakdown {
  rawDiscoveredCount: number;
  normalizedCount: number;
  inCityBoundsCount: number;
  deduplicatedCount: number;
  phoneCount: number;
  emailCount: number;
  phoneOrEmailCount: number;
  websiteAvailableCount: number;
  websiteUnavailableCount: number;
  websiteUnreachableCount: number;
  finalQualifiedCount: number;
}

export interface RejectedCandidateItem {
  name: string;
  category?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  websiteStatus?: string;
  sources?: string[];
  rejectionReason: 'NO_CONTACT' | 'HAS_WEBSITE' | 'NO_WEBSITE' | 'WEBSITE_UNREACHABLE' | 'OUTSIDE_LOCATION' | 'DUPLICATE' | 'MISSING_NAME' | 'OTHER';
  rejectionDetails?: string;
}

export interface SearchRequestPayload {
  country: 'India';
  state: string;
  city?: string;
  industry: string;
  contactFilter?: ContactFilter;
  websiteFilter?: WebsiteFilter;
  limit: number;
}

export type LeadStatus = 'New' | 'In Review' | 'Contacted' | 'Qualified' | 'Unresponsive';

export interface Lead {
  id: string;
  source: string; // e.g. "openstreetmap"
  sources?: string[];
  sourceEvidence?: any[];
  sourceId?: string; // e.g. "osm:node:12345"
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number | string;
  placeId?: string;
  businessName: string;
  legalName?: string;
  category: string;
  industry: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string | null;
  phoneSource?: string | null;
  email?: string | null;
  emailSource?: string | null;
  websiteUrl?: string;
  websiteSource?: string | null;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  businessStatus?: string;
  websiteStatus?: WebsiteStatus;
  websiteIssues?: string[];
  websiteAudit?: StructuredWebsiteAudit;
  sourceUrl?: string;
  discoveredAt?: string;
  createdAt?: string;
  updatedAt?: string;
  dateDiscovered?: string;

  // Backward-compatible structured sub-objects for existing dashboard components
  location: {
    city: string;
    state?: string;
    country: string;
    address: string;
    postcode?: string;
  };
  website: {
    url?: string;
    hasWebsite: boolean;
    status: WebsiteStatus;
    subStatus?: string;
    qualityReason?: string;
    detectedIssues?: string[];
    pagesAnalyzed?: number;
    speedScore?: number;
    mobileOptimized?: boolean;
    sslSecure?: boolean;
    issuesCount?: number;
    lastAudited?: string;
  };
  contact: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    hasEmail?: boolean;
    hasPhone?: boolean;
    verified: boolean;
    linkedin?: string;
    contactType?: 'Email + Phone' | 'Phone' | 'Email' | 'None';
  };
  leadScore: number; // 0 - 100
  notes?: string;
  auditIssues?: string[];
  aiOpportunity?: string;
  demoGenerated?: boolean;
  estimatedRevenue?: string;
  employeeCount?: string;
}

export interface MetricSummary {
  businessesFound: number;
  noWebsite: number;
  poorWebsite: number;
  qualifiedLeads: number;
  totalLeads?: number;
  totalLeadsChange?: number;
  newLeads?: number;
  newLeadsChange?: number;
  noWebsiteChange?: number;
  poorWebsiteChange?: number;
  contactable?: number;
  contactablePercentage?: number;
}

export type NavTab = 
  | 'overview' 
  | 'find-leads' 
  | 'leads' 
  | 'website-audit' 
  | 'campaigns' 
  | 'ai-messages' 
  | 'demo-websites' 
  | 'settings' 
  | 'help';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface SearchJobRecord {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  criteria: SearchRequestPayload;
  totalDiscovered: number;
  totalMatched: number;
  summary: SearchSummary;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
