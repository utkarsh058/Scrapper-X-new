export type ActorStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export type SearchStatusType = 'COMPLETE' | 'PARTIAL' | 'NO_RESULTS' | 'FAILED';

export type RejectionReason =
  | 'OUTSIDE_LOCATION'
  | 'INVALID_CATEGORY'
  | 'MISSING_NAME'
  | 'DUPLICATE'
  | 'NO_CONTACT'
  | 'HAS_WEBSITE'
  | 'NO_WEBSITE'
  | 'WEBSITE_UNREACHABLE'
  | 'AUDIT_FAILED'
  | 'NOT_QUALIFIED';

export type BusinessVerificationStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

export type LocationVerificationStatus = 'VERIFIED' | 'OUTSIDE_LOCATION' | 'UNVERIFIED';

export type WebsiteReachabilityStatus =
  | 'LIVE'
  | 'REDIRECTED'
  | 'UNREACHABLE'
  | 'DNS_ERROR'
  | 'SSL_ERROR'
  | 'TIMEOUT'
  | 'FOUND'
  | 'NOT_FOUND'
  | 'NO_WEBSITE'
  | 'UNKNOWN';

export type ContactFilterType =
  | 'ALL_CONTACTS'
  | 'EMAIL_AND_PHONE'
  | 'EMAIL_ONLY'
  | 'PHONE_ONLY'
  | 'PHONE_OR_EMAIL'
  | 'NO_CONTACT';

export type WebsiteFilterType =
  | 'ANY_WEBSITE'
  | 'NO_WEBSITE'
  | 'WEBSITE_AVAILABLE'
  | 'NEEDS_IMPROVEMENT'
  | 'UNREACHABLE';
