# LeadPilot API Boundaries & Architectural Contracts

This document specifies the strict architectural boundaries, contracts, responsibilities, and error states for LeadPilot.

---

## 1. High-Level Architectural Flow

```text
Frontend (Dashboard / UI)
   │
   ▼
Public LeadPilot API (`/api/searches`, `/api/businesses/*`)
   │
   ▼
Application Services (`BusinessDiscoveryService`)
   │
   ├──────────────────────────────┼──────────────────────────────┐
   ▼                              ▼                              ▼
Discovery Pipeline          Enrichment Pipeline            Ranking / Eligibility
   │                              │                              │
   ▼                              ▼                              ▼
Provider Adapters           Provider Adapters              Pure Logic
(Google Places New, OSM)    (Website Crawler, Social)      (5.0 Excluded, reviewCount DESC)
   │                              │
   ▼                              ▼
External APIs               External Sites
(Google Places API)         (HTML, JSON-LD, OpenGraph)
   │                              │
   └──────────────┬───────────────┘
                  ▼
          Normalization (`GoogleBusinessCandidate`, `OSMProfileCandidate`)
                  ▼
          Validation & Identity Resolution (`BusinessIdentityResolutionService`)
                  ▼
          Provenance Tracking (`ProvenanceService` / `SourceEvidence`)
                  ▼
          Database Persistence (`Prisma` / In-Memory Store)
                  ▼
          Ranking & Server-side Filtering (`BusinessRankingService`)
                  ▼
          Public API Response (`CanonicalBusiness[]`)
                  ▼
Frontend (Dashboard / LeadsTable / LeadDetailDrawer)
```

---

## 2. Responsibility Matrix

| Responsibility | Owner | Component Path |
|---|---|---|
| User Search Dispatch | Public Search API | `src/app/api/searches/route.ts` |
| Pipeline Status & Progress | Status API | `src/app/api/searches/[searchId]/route.ts` |
| Paginated & Filtered Results | Results API | `src/app/api/searches/[searchId]/results/route.ts` |
| Business Detail APIs | Business API | `src/app/api/businesses/[businessId]/*` |
| Discovery Coordination | Business Discovery Service | `src/services/discovery/BusinessDiscoveryService.ts` |
| Google Places (New) Calls | Google Places Provider | `src/providers/google/GooglePlacesProvider.ts` |
| OpenStreetMap Calls | OSM Overpass Provider | `src/providers/OSMOverpassProvider.ts` |
| Google Data Normalization | Google Places Provider | `src/providers/google/GooglePlacesProvider.ts` |
| Multi-Source Identity Resolution | Identity Resolution Service | `src/services/identity/BusinessIdentityResolutionService.ts` |
| 5-Star Rating Exclusion | Eligibility Service | `src/services/eligibility/BusinessEligibilityService.ts` |
| Review Sorting & Ranking | Ranking Service | `src/services/ranking/BusinessRankingService.ts` |
| Review Summary & Metrics | Review Intelligence Service | `src/services/reviews/ReviewIntelligenceService.ts` |
| Website HTML Extraction | Website Social Extractor | `src/services/social/WebsiteSocialExtractor.ts` |
| Social Identity Matching | Social Verification Service | `src/services/social/SocialIdentityVerificationService.ts` |
| Social Profile Coordination | Social Discovery Service | `src/services/social/SocialDiscoveryService.ts` |
| Field-Level Evidence Tracking | Provenance Service | `src/services/evidence/ProvenanceService.ts` |
| Relational Persistence | Prisma Models & DB Store | `prisma/schema.prisma`, `src/db/index.ts` |
| Frontend Presentation | React Components | `src/components/dashboard/*` |
| Secrets Management | Environment Variables | Server-side `.env` only |

---

## 3. Public API Layer

### 3.1 Start Search
- **Endpoint**: `POST /api/searches`
- **Allowed Callers**: Frontend, API clients
- **Request Body**:
```json
{
  "query": "restaurants",
  "location": {
    "city": "Greater Noida",
    "state": "Uttar Pradesh",
    "country": "India"
  },
  "filters": {
    "excludePerfectRating": true,
    "minReviews": 0
  },
  "sort": {
    "field": "reviewCount",
    "direction": "desc"
  },
  "page": 1,
  "limit": 50
}
```
- **Response**: `HTTP 201 Created`
```json
{
  "searchId": "search_1741000000000_abcde",
  "status": "CREATED"
}
```

### 3.2 Search Pipeline Status
- **Endpoint**: `GET /api/searches/:searchId`
- **Response**: `HTTP 200 OK`
```json
{
  "searchId": "search_1741000000000_abcde",
  "status": "DISCOVERING",
  "progress": {
    "discovered": 65,
    "processed": 40,
    "completed": 35,
    "failed": 0,
    "stepMessage": "Querying configured discovery providers..."
  },
  "createdAt": "2026-10-04T01:30:00.000Z",
  "updatedAt": "2026-10-04T01:30:02.000Z"
}
```
**Allowed Pipeline Statuses**:
- `CREATED`: Session created and queued.
- `DISCOVERING`: Calling Google Places (New) and OpenStreetMap.
- `DEDUPLICATING`: Cross-source identity resolution and entity deduplication.
- `ENRICHING`: Website reachability and technical audits.
- `SOCIAL_DISCOVERY`: Extracting authentic public social media handles.
- `FILTERING`: Applying business rules (including strict 5.0 rating exclusion).
- `RANKING`: Deterministic ranking (`reviewCount DESC`, `rating DESC`).
- `READY`: Results ready for consumption.
- `PARTIAL`: Discovery completed with partial data or limited results.
- `FAILED`: Unrecoverable execution error.

### 3.3 Search Results (Server-side Filtered & Paginated)
- **Endpoint**: `GET /api/searches/:searchId/results`
- **Query Parameters**:
  - `page` (integer, default 1)
  - `limit` (integer, default 50)
  - `sortField` (`reviewCount` | `rating` | `name`)
  - `sortDirection` (`desc` | `asc`)
  - `minReviews`, `maxReviews` (integer)
  - `minRating`, `maxRating` (float)
  - `hasWebsite`, `hasPhone`, `hasEmail` (boolean)
  - `hasInstagram`, `hasFacebook`, `hasYouTube`, `hasLinkedIn`, `hasTikTok` (boolean)
  - `hasAnySocial` (boolean)

### 3.4 Business Entity APIs
- `GET /api/businesses/:businessId`: Canonical business object.
- `GET /api/businesses/:businessId/social`: Social profiles and snapshots.
- `GET /api/businesses/:businessId/reviews`: Review summary and real reviews.
- `GET /api/businesses/:businessId/provenance`: Field-level source evidence.

---

## 4. Provider Boundaries & Contracts

### 4.1 Google Places Provider (`GooglePlacesProvider`)
- Uses **Google Places API (New)** Text Search (`/v1/places:searchText`) and Details (`/v1/places/{placeId}`).
- **Required Fields in FieldMask**:
  `places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,nextPageToken`
- **Strict Boundary**:
  - Does NOT calculate lead scores.
  - Does NOT exclude 5.0 ratings.
  - Does NOT discover social media.
  - Does NOT write directly to the database.
  - Returns `GoogleBusinessCandidate` or `GoogleBusinessDetails`.

### 4.2 OpenStreetMap Provider (`OSMOverpassProvider`)
- Secondary / cross-check source using Overpass API.
- Supplies coordinates, OSM tags, addresses, and discovered contacts.
- Retained to enrich Google data or discover venues not on Google.

---

## 5. Review & Rating Rules

1. **5.0 Rating Exclusion Boundary (`BusinessEligibilityService`)**:
   - `rating === 5.0` -> `included: false, excludedReason: 'PERFECT_5_STAR_RATING'`
   - `4.9` -> `included: true`
   - `4.8` -> `included: true`
   - `null` -> `included: true` (NEVER assume `null === 5.0`)
   - Excluded businesses are never deleted; their eligibility state is preserved.

2. **Deterministic Ranking Boundary (`BusinessRankingService`)**:
   - Primary: Eligible businesses rank before excluded.
   - Secondary: `reviewCount DESC`.
   - Tertiary: `rating DESC`.
   - Tie-breaker: `name ASC`.
   - No opaque AI scores.

3. **No Synthetic Sentiment Rule (`ReviewIntelligenceService`)**:
   - Do NOT invent `positiveReviewCount` or sentiment percentages from a numeric rating (e.g. 4.7 is not assumed to be 1,150 positive reviews).
   - Sentiment is only reported if actual review text items are retrieved.

---

## 6. Social Media Intelligence Rules

1. **Extraction (`WebsiteSocialExtractor`)**:
   - Scans website HTML, JSON-LD, metadata, header, footer for valid social links.
   - Platforms: Instagram, Facebook, YouTube, LinkedIn, TikTok, Twitter/X, Pinterest, Threads.

2. **Verification (`SocialIdentityVerificationService`)**:
   - Website-extracted links -> `confidence: 0.98` (`HIGH`).
   - Public search candidates require matching name + city or official domain in bio.

3. **Creation Date & Followers Boundary (`SocialDiscoveryService`)**:
   - Missing follower counts = `null` (NEVER `0`).
   - Exact creation date = `null`, `createdAtType: 'NOT_AVAILABLE'` (NEVER guessed from review dates or post dates).
   - First observed date = `firstSeenAt: new Date()` (indicates when LeadPilot discovered it).

---

## 7. Provenance Model (`SourceEvidence`)

Every external field stores provenance:
```json
{
  "entityType": "business",
  "entityId": "biz_ChIJ_example",
  "field": "phone",
  "value": "+91 120 123 4567",
  "source": "google_places",
  "capturedAt": "2026-10-04T01:30:00.000Z",
  "confidence": "HIGH"
}
```

---

## 8. Provider Statuses & Failure Behavior

Providers return structured statuses:
- `SUCCESS`: Valid data returned.
- `NOT_CONFIGURED`: Missing API credentials (e.g., `GOOGLE_PLACES_API_KEY`).
- `RATE_LIMITED`: Upstream rate limit or quota exceeded (HTTP 429).
- `API_ERROR`: Upstream network error or non-200 HTTP response.
- `NOT_AVAILABLE`: Provider disabled or timeout exceeded.

**Zero Fake Data Rule**: If an API is unavailable or returns an error, the pipeline marks the status as `PARTIAL` or `FAILED`. It NEVER substitutes mock, demo, or synthetic businesses.
