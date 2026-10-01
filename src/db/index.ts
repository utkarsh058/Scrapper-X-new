import fs from 'fs';
import path from 'path';
import { LeadEntity } from '@/models/Lead';
import { Job, ActorRun } from '@/models/Job';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  expiresAt: number; // unix timestamp in ms
}

interface StoredDbData {
  leads: Record<string, LeadEntity>;
  jobs: Record<string, Job>;
  actorRuns: Record<string, ActorRun>;
}

class LeadPilotDatabase {
  private leadsMap: Map<string, LeadEntity> = new Map();
  private jobsMap: Map<string, Job> = new Map();
  private actorRunsMap: Map<string, ActorRun> = new Map();
  private cacheMap: Map<string, CacheEntry> = new Map();
  private filePath: string;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'leadpilot_db.json');
    this.loadState();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed: StoredDbData = JSON.parse(raw);

        if (parsed.leads) {
          for (const [k, v] of Object.entries(parsed.leads)) {
            this.leadsMap.set(k, v);
          }
        }
        if (parsed.jobs) {
          for (const [k, v] of Object.entries(parsed.jobs)) {
            this.jobsMap.set(k, v);
          }
        }
        if (parsed.actorRuns) {
          for (const [k, v] of Object.entries(parsed.actorRuns)) {
            this.actorRunsMap.set(k, v);
          }
        }
      }
    } catch (err: any) {
      console.warn('[LeadPilotDatabase] Failed to load persistent state:', err.message);
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) return;
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      this.persistState();
    }, 250);
  }

  private persistState(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data: StoredDbData = {
        leads: Object.fromEntries(this.leadsMap.entries()),
        jobs: Object.fromEntries(Array.from(this.jobsMap.entries()).slice(-100)), // keep last 100 jobs
        actorRuns: Object.fromEntries(Array.from(this.actorRunsMap.entries()).slice(-500)), // keep last 500 runs
      };

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[LeadPilotDatabase] Failed to persist state:', err.message);
    }
  }

  // --- Leads Operations ---
  public upsertLead(lead: LeadEntity): LeadEntity {
    lead.updatedAt = new Date().toISOString();
    this.leadsMap.set(lead.leadId, lead);
    this.scheduleSave();
    return lead;
  }

  public upsertLeadsBatch(leads: LeadEntity[]): void {
    for (const lead of leads) {
      lead.updatedAt = new Date().toISOString();
      this.leadsMap.set(lead.leadId, lead);
    }
    this.scheduleSave();
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
    this.scheduleSave();
    return job;
  }

  public updateJob(jobId: string, updates: Partial<Job>): Job | undefined {
    const existing = this.jobsMap.get(jobId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.jobsMap.set(jobId, updated);
    this.scheduleSave();
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
    this.scheduleSave();
    return run;
  }

  public updateActorRun(runId: string, updates: Partial<ActorRun>): ActorRun | undefined {
    const existing = this.actorRunsMap.get(runId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.actorRunsMap.set(runId, updated);
    this.scheduleSave();
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

