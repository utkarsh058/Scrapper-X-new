import { Lead, StructuredWebsiteAudit, SearchSummary, SearchRequestPayload } from '@/types';
import { prisma } from './prisma';

export interface StoredLeadRecord {
  id: string;
  source: string;
  sourceId: string;
  businessName: string;
  category: string;
  industry: string;
  address: string;
  state: string;
  city: string;
  postcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  businessStatus?: string;
  websiteStatus: string;
  websiteIssues: string[];
  websitePagesAnalyzed: number;
  hasEmail: boolean;
  hasPhone: boolean;
  createdAt: string;
  updatedAt: string;
  rawLead: Lead;
}

export interface StoredWebsiteAuditRecord {
  id: string;
  leadId: string;
  url: string;
  status: string;
  reasons: string[];
  audit: StructuredWebsiteAudit;
  createdAt: string;
}

export interface StoredSearchJobRecord {
  id: string;
  status: 'completed' | 'failed';
  criteria: SearchRequestPayload;
  totalDiscovered: number;
  totalMatched: number;
  summary: SearchSummary;
  createdAt: string;
}

export interface StoredDataSourceRecord {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  active: boolean;
  lastUsedAt: string;
}

/**
 * Persistent Canonical Leads Database Service
 * Backed by Prisma SQLite/PostgreSQL
 */
class LeadsDatabase {
  // In-memory fallback cache for fast read synchronization
  private memoryCache: Map<string, StoredLeadRecord> = new Map();

  public async upsertLeadAsync(lead: Lead): Promise<StoredLeadRecord> {
    const hasEmail = Boolean(lead.email || (lead.contact?.email && lead.contact.email !== 'Not available'));
    const hasPhone = Boolean(lead.phone || (lead.contact?.phone && lead.contact.phone !== 'Not available'));
    const now = new Date();

    try {
      const dbBusiness = await prisma.business.upsert({
        where: { id: lead.id },
        update: {
          name: lead.businessName,
          category: lead.category,
          industry: lead.industry,
          address: lead.address || lead.location?.address,
          city: lead.city || lead.location?.city,
          state: lead.state || lead.location?.state,
          country: lead.location?.country || 'India',
          postcode: lead.postcode || lead.location?.postcode,
          phone: lead.phone || lead.contact?.phone,
          email: lead.email || lead.contact?.email,
          websiteUrl: lead.websiteUrl || lead.website?.url,
          latitude: lead.latitude,
          longitude: lead.longitude,
          businessStatus: lead.businessStatus || 'OPERATIONAL',
          opportunityScore: lead.leadScore || 0,
        },
        create: {
          id: lead.id,
          name: lead.businessName,
          category: lead.category,
          industry: lead.industry,
          address: lead.address || lead.location?.address,
          city: lead.city || lead.location?.city,
          state: lead.state || lead.location?.state,
          country: lead.location?.country || 'India',
          postcode: lead.postcode || lead.location?.postcode,
          phone: lead.phone || lead.contact?.phone,
          email: lead.email || lead.contact?.email,
          websiteUrl: lead.websiteUrl || lead.website?.url,
          latitude: lead.latitude,
          longitude: lead.longitude,
          businessStatus: lead.businessStatus || 'OPERATIONAL',
          opportunityScore: lead.leadScore || 0,
        },
      });

      const record: StoredLeadRecord = {
        id: dbBusiness.id,
        source: lead.source || 'LeadPilot',
        sourceId: lead.sourceId || lead.id,
        businessName: dbBusiness.name,
        category: dbBusiness.category,
        industry: dbBusiness.industry,
        address: dbBusiness.address || '',
        state: dbBusiness.state || '',
        city: dbBusiness.city || '',
        postcode: dbBusiness.postcode || undefined,
        phone: dbBusiness.phone || undefined,
        email: dbBusiness.email || undefined,
        website: dbBusiness.websiteUrl || undefined,
        latitude: dbBusiness.latitude || undefined,
        longitude: dbBusiness.longitude || undefined,
        businessStatus: dbBusiness.businessStatus,
        websiteStatus: lead.websiteStatus || lead.website?.status || 'No Website',
        websiteIssues: lead.websiteIssues || lead.website?.detectedIssues || [],
        websitePagesAnalyzed: lead.website?.pagesAnalyzed || (lead.website?.hasWebsite ? 1 : 0),
        hasEmail,
        hasPhone,
        createdAt: dbBusiness.createdAt.toISOString(),
        updatedAt: dbBusiness.updatedAt.toISOString(),
        rawLead: lead,
      };

      this.memoryCache.set(record.id, record);
      return record;
    } catch {
      // Fallback in-memory
      const fallbackRecord: StoredLeadRecord = {
        id: lead.id,
        source: lead.source || 'LeadPilot',
        sourceId: lead.sourceId || lead.id,
        businessName: lead.businessName,
        category: lead.category,
        industry: lead.industry,
        address: lead.address || lead.location?.address || '',
        state: lead.state || lead.location?.state || '',
        city: lead.city || lead.location?.city || '',
        postcode: lead.postcode || lead.location?.postcode,
        phone: lead.phone || lead.contact?.phone,
        email: lead.email || lead.contact?.email,
        website: lead.websiteUrl || lead.website?.url,
        latitude: lead.latitude,
        longitude: lead.longitude,
        businessStatus: lead.businessStatus || 'OPERATIONAL',
        websiteStatus: lead.websiteStatus || lead.website?.status || 'No Website',
        websiteIssues: lead.websiteIssues || lead.website?.detectedIssues || [],
        websitePagesAnalyzed: lead.website?.pagesAnalyzed || (lead.website?.hasWebsite ? 1 : 0),
        hasEmail,
        hasPhone,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        rawLead: lead,
      };
      this.memoryCache.set(lead.id, fallbackRecord);
      return fallbackRecord;
    }
  }

  // Synchronous contract wrapper for backwards compatibility
  public upsertLead(lead: Lead): StoredLeadRecord {
    this.upsertLeadAsync(lead).catch((err) => console.warn('[leadsDb] Async upsert warning:', err));
    const hasEmail = Boolean(lead.email || (lead.contact?.email && lead.contact.email !== 'Not available'));
    const hasPhone = Boolean(lead.phone || (lead.contact?.phone && lead.contact.phone !== 'Not available'));

    const record: StoredLeadRecord = {
      id: lead.id,
      source: lead.source || 'LeadPilot',
      sourceId: lead.sourceId || lead.id,
      businessName: lead.businessName,
      category: lead.category,
      industry: lead.industry,
      address: lead.address || lead.location?.address || '',
      state: lead.state || lead.location?.state || '',
      city: lead.city || lead.location?.city || '',
      postcode: lead.postcode || lead.location?.postcode,
      phone: lead.phone || lead.contact?.phone,
      email: lead.email || lead.contact?.email,
      website: lead.websiteUrl || lead.website?.url,
      latitude: lead.latitude,
      longitude: lead.longitude,
      businessStatus: lead.businessStatus || 'OPERATIONAL',
      websiteStatus: lead.websiteStatus || lead.website?.status || 'No Website',
      websiteIssues: lead.websiteIssues || lead.website?.detectedIssues || [],
      websitePagesAnalyzed: lead.website?.pagesAnalyzed || (lead.website?.hasWebsite ? 1 : 0),
      hasEmail,
      hasPhone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawLead: lead,
    };
    this.memoryCache.set(lead.id, record);
    return record;
  }

  public upsertBatch(leads: Lead[]): StoredLeadRecord[] {
    return leads.map((l) => this.upsertLead(l));
  }

  public getAll(): StoredLeadRecord[] {
    return Array.from(this.memoryCache.values());
  }

  public getById(id: string): StoredLeadRecord | undefined {
    return this.memoryCache.get(id);
  }

  public count(): number {
    return this.memoryCache.size;
  }

  public async getPersistedLeads(limit: number = 100): Promise<Lead[]> {
    try {
      const records = await prisma.business.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          audits: { take: 1, orderBy: { auditedAt: 'desc' } },
          contacts: { take: 1 },
          scores: { take: 1, orderBy: { calculatedAt: 'desc' } },
          outreach: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      });

      return records.map((b) => {
        const audit = b.audits[0];
        const contact = b.contacts[0];
        const score = b.scores[0];
        const latestOutreach = b.outreach?.[0];
        const detectedIssues = audit?.detectedIssues ? JSON.parse(audit.detectedIssues) : [];

        let outreachStatus: 'Not Contacted' | 'Queued' | 'Sent' | 'Delivered' | 'Failed' | 'Suppressed' = 'Not Contacted';
        if (latestOutreach) {
          if (latestOutreach.status === 'SENT') outreachStatus = 'Sent';
          else if (latestOutreach.status === 'DELIVERED') outreachStatus = 'Delivered';
          else if (['PENDING', 'QUEUED', 'SENDING'].includes(latestOutreach.status)) outreachStatus = 'Queued';
          else if (latestOutreach.status === 'FAILED') outreachStatus = 'Failed';
          else if (latestOutreach.status === 'SUPPRESSED') outreachStatus = 'Suppressed';
        }

        const hasPhone = Boolean(b.phone);
        const hasEmail = Boolean(b.email);
        const hasWebsite = Boolean(b.websiteUrl);

        return {
          id: b.id,
          source: 'Canonical Database',
          sourceId: b.id,
          businessName: b.name,
          category: b.category,
          industry: b.industry,
          address: b.address || undefined,
          city: b.city || undefined,
          state: b.state || undefined,
          postcode: b.postcode || undefined,
          phone: b.phone || undefined,
          email: b.email || undefined,
          websiteUrl: b.websiteUrl || undefined,
          latitude: b.latitude || undefined,
          longitude: b.longitude || undefined,
          businessStatus: b.businessStatus,
          websiteStatus: (audit?.status as any) || (hasWebsite ? 'Working' : 'No Website'),
          websiteIssues: detectedIssues,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
          dateDiscovered: b.createdAt.toISOString().split('T')[0],

          location: {
            city: b.city || '',
            state: b.state || undefined,
            country: b.country,
            address: b.address || `${b.city || ''}, India`,
            postcode: b.postcode || undefined,
          },
          website: {
            url: b.websiteUrl || undefined,
            hasWebsite,
            status: (audit?.status as any) || (hasWebsite ? 'Working' : 'No Website'),
            detectedIssues,
            qualityReason: detectedIssues[0],
            pagesAnalyzed: hasWebsite ? 1 : 0,
            speedScore: audit?.performanceScore || undefined,
            mobileOptimized: audit?.hasMobileViewport,
            sslSecure: audit ? audit.status !== 'Unreachable' : undefined,
          },
          contact: {
            name: contact?.name || b.name,
            email: b.email || undefined,
            phone: b.phone || undefined,
            hasEmail,
            hasPhone,
            verified: contact?.verificationStatus === 'VERIFIED',
            contactType: hasEmail && hasPhone ? 'Email + Phone' : hasPhone ? 'Phone' : hasEmail ? 'Email' : 'None',
          },
          leadScore: b.opportunityScore,
          outreachStatus,
          lastOutreachAt: latestOutreach?.sentAt?.toISOString(),
          notes: detectedIssues.join('. '),
          auditIssues: detectedIssues,
        };
      });
    } catch {
      return this.getAll().map((s) => s.rawLead);
    }
  }

  public recordSearchJob(job: StoredSearchJobRecord): void {
    prisma.job
      .create({
        data: {
          id: job.id,
          status: job.status.toUpperCase(),
          criteria: JSON.stringify(job.criteria),
          totalDiscovered: job.totalDiscovered,
          totalProcessed: job.totalDiscovered,
          totalQualified: job.totalMatched,
        },
      })
      .catch((err) => console.warn('[leadsDb] Job record warning:', err));
  }

  public getDataSources(): StoredDataSourceRecord[] {
    return [
      {
        id: 'google_places',
        name: 'Google Places API (New)',
        provider: 'Google Cloud Platform',
        endpoint: 'https://places.googleapis.com/v1/places:searchText',
        active: Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'osm',
        name: 'OpenStreetMap (Overpass API)',
        provider: 'OSM Overpass',
        endpoint: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
        active: true,
        lastUsedAt: new Date().toISOString(),
      },
      {
        id: 'pagespeed',
        name: 'Google PageSpeed Insights v5',
        provider: 'Google API',
        endpoint: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
        active: Boolean(process.env.PAGESPEED_API_KEY),
        lastUsedAt: new Date().toISOString(),
      },
    ];
  }
}

const globalForDb = global as unknown as { leadsDb: LeadsDatabase };
export const leadsDb = globalForDb.leadsDb || new LeadsDatabase();
if (process.env.NODE_ENV !== 'production') globalForDb.leadsDb = leadsDb;
