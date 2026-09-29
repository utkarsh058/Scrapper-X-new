import { Lead, StructuredWebsiteAudit, SearchSummary, SearchRequestPayload } from '@/types';

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

// In-memory cache & store for analyzed leads, audits, search jobs, and sources
class LeadsDatabase {
  private leadsMap: Map<string, StoredLeadRecord> = new Map();
  private auditsMap: Map<string, StoredWebsiteAuditRecord> = new Map();
  private searchJobsMap: Map<string, StoredSearchJobRecord> = new Map();
  private dataSourcesMap: Map<string, StoredDataSourceRecord> = new Map();

  constructor() {
    // Initialize default data sources
    this.dataSourcesMap.set('osm', {
      id: 'osm',
      name: 'OpenStreetMap (Overpass API)',
      provider: 'OSM Overpass',
      endpoint: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
      active: true,
      lastUsedAt: new Date().toISOString()
    });

    this.dataSourcesMap.set('firecrawl', {
      id: 'firecrawl',
      name: 'Firecrawl API',
      provider: 'Firecrawl',
      endpoint: 'https://api.firecrawl.dev/v1/scrape',
      active: Boolean(process.env.FIRECRAWL_API_KEY),
      lastUsedAt: new Date().toISOString()
    });
  }

  // Leads repository
  public upsertLead(lead: Lead): StoredLeadRecord {
    const now = new Date().toISOString();
    const existing = this.leadsMap.get(lead.id);

    const hasEmail = Boolean(lead.email || (lead.contact?.email && lead.contact.email !== 'Not available'));
    const hasPhone = Boolean(lead.phone || (lead.contact?.phone && lead.contact.phone !== 'Not available'));

    const record: StoredLeadRecord = {
      id: lead.id,
      source: lead.source || 'OpenStreetMap',
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
      openingHours: lead.openingHours,
      businessStatus: lead.businessStatus || 'OPERATIONAL',
      websiteStatus: lead.websiteStatus || lead.website?.status || 'No Website',
      websiteIssues: lead.websiteIssues || lead.website?.detectedIssues || [],
      websitePagesAnalyzed: lead.website?.pagesAnalyzed || (lead.website?.hasWebsite ? 1 : 0),
      hasEmail,
      hasPhone,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      rawLead: lead,
    };

    this.leadsMap.set(lead.id, record);

    // If structured audit is present, also store in audits table
    if (lead.websiteAudit && lead.websiteUrl) {
      this.auditsMap.set(lead.id, {
        id: `audit_${lead.id}`,
        leadId: lead.id,
        url: lead.websiteUrl,
        status: lead.websiteStatus || lead.website?.status || 'Working',
        reasons: lead.websiteIssues || [],
        audit: lead.websiteAudit,
        createdAt: now
      });
    }

    return record;
  }

  public upsertBatch(leads: Lead[]): StoredLeadRecord[] {
    return leads.map((l) => this.upsertLead(l));
  }

  public getAll(): StoredLeadRecord[] {
    return Array.from(this.leadsMap.values());
  }

  public getById(id: string): StoredLeadRecord | undefined {
    return this.leadsMap.get(id);
  }

  public count(): number {
    return this.leadsMap.size;
  }

  // Audits repository
  public getAuditByLeadId(leadId: string): StoredWebsiteAuditRecord | undefined {
    return this.auditsMap.get(leadId);
  }

  // Search Jobs repository
  public recordSearchJob(job: StoredSearchJobRecord): void {
    this.searchJobsMap.set(job.id, job);
  }

  public getSearchJobs(): StoredSearchJobRecord[] {
    return Array.from(this.searchJobsMap.values());
  }

  // Data Sources repository
  public getDataSources(): StoredDataSourceRecord[] {
    return Array.from(this.dataSourcesMap.values());
  }
}

// Global singleton instance across Next.js API calls
const globalForDb = global as unknown as { leadsDb: LeadsDatabase };
export const leadsDb = globalForDb.leadsDb || new LeadsDatabase();
if (process.env.NODE_ENV !== 'production') globalForDb.leadsDb = leadsDb;
