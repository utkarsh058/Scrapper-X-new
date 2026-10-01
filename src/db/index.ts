import { LeadEntity } from '@/models/Lead';
import { Job, ActorRun } from '@/models/Job';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  expiresAt: number; // unix timestamp in ms
}

class LeadPilotDatabase {
  private leadsMap: Map<string, LeadEntity> = new Map();
  private jobsMap: Map<string, Job> = new Map();
  private actorRunsMap: Map<string, ActorRun> = new Map();
  private cacheMap: Map<string, CacheEntry> = new Map();

  // --- Leads Operations ---
  public upsertLead(lead: LeadEntity): LeadEntity {
    lead.updatedAt = new Date().toISOString();
    this.leadsMap.set(lead.leadId, lead);
    return lead;
  }

  public upsertLeadsBatch(leads: LeadEntity[]): void {
    for (const lead of leads) {
      lead.updatedAt = new Date().toISOString();
      this.leadsMap.set(lead.leadId, lead);
    }
  }

  public getLead(leadId: string): LeadEntity | undefined {
    return this.leadsMap.get(leadId);
  }

  public getAllLeads(): LeadEntity[] {
    return Array.from(this.leadsMap.values());
  }

  /**
   * Section 12 & 26: Finds previously discovered and verified businesses for the location & industry.
   * Enables persistent data reuse without calling external APIs repeatedly.
   */
  public findLeadsByLocationAndIndustry(params: {
    state: string;
    city?: string;
    industry: string;
  }): LeadEntity[] {
    const norm = (s?: string) => (s || '').toLowerCase().trim();
    const targetState = norm(params.state);
    const targetCity = params.city ? norm(params.city) : '';
    const targetInd = norm(params.industry);

    return Array.from(this.leadsMap.values()).filter((lead) => {
      const lState = norm(lead.state);
      const lCity = norm(lead.city);
      const lInd = norm(lead.industry || lead.category);

      const stateMatch = lState === targetState || lState.includes(targetState) || targetState.includes(lState);
      const cityMatch = !targetCity || lCity === targetCity || lCity.includes(targetCity) || targetCity.includes(lCity);
      const indMatch = lInd === targetInd || lInd.includes(targetInd) || targetInd.includes(lInd);

      return stateMatch && cityMatch && indMatch;
    });
  }

  // --- Jobs Operations ---
  public createJob(job: Job): Job {
    this.jobsMap.set(job.id, job);
    return job;
  }

  public updateJob(jobId: string, updates: Partial<Job>): Job | undefined {
    const existing = this.jobsMap.get(jobId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.jobsMap.set(jobId, updated);
    return updated;
  }

  public getJob(jobId: string): Job | undefined {
    return this.jobsMap.get(jobId);
  }

  public listJobs(): Job[] {
    return Array.from(this.jobsMap.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  // --- ActorRuns Operations ---
  public createActorRun(run: ActorRun): ActorRun {
    this.actorRunsMap.set(run.id, run);
    return run;
  }

  public updateActorRun(runId: string, updates: Partial<ActorRun>): ActorRun | undefined {
    const existing = this.actorRunsMap.get(runId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.actorRunsMap.set(runId, updated);
    return updated;
  }

  public getActorRunsByJob(jobId: string): ActorRun[] {
    return Array.from(this.actorRunsMap.values()).filter((r) => r.jobId === jobId);
  }

  // --- Caching Operations ---
  public getCache<T = any>(key: string): T | null {
    const entry = this.cacheMap.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cacheMap.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public setCache<T = any>(key: string, data: T, ttlMs: number = 3600000): void {
    this.cacheMap.set(key, {
      key,
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clearExpiredCache(): void {
    const now = Date.now();
    for (const [k, v] of this.cacheMap.entries()) {
      if (now > v.expiresAt) {
        this.cacheMap.delete(k);
      }
    }
  }
}

export const leadPilotDb = new LeadPilotDatabase();
