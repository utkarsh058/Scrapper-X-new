/**
 * Provenance Service
 * 
 * Strict Single Responsibility:
 * First-class evidence tracking for every major external field.
 * 
 * Entities:
 * - business
 * - contact
 * - social_profile
 * - review_summary
 */

import { SourceEvidence } from '@/types/canonical';

class ProvenanceService {
  private evidenceStore: Map<string, SourceEvidence[]> = new Map();

  /**
   * Registers a piece of source evidence for an entity
   */
  public recordEvidence(evidence: SourceEvidence): void {
    const existing = this.evidenceStore.get(evidence.entityId) || [];
    // Avoid duplicate evidence for same entity + field + source + value
    const isDup = existing.some(
      (e) =>
        e.field === evidence.field &&
        e.source === evidence.source &&
        e.value === evidence.value
    );

    if (!isDup) {
      existing.push({
        ...evidence,
        id: evidence.id || `evi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });
      this.evidenceStore.set(evidence.entityId, existing);
    }
  }

  /**
   * Batch records evidence items
   */
  public recordEvidenceBatch(items: SourceEvidence[]): void {
    for (const item of items) {
      this.recordEvidence(item);
    }
  }

  /**
   * Gets all provenance evidence for an entity ID
   */
  public getEvidenceForEntity(entityId: string): SourceEvidence[] {
    return this.evidenceStore.get(entityId) || [];
  }

  /**
   * Clears evidence (primarily for unit tests)
   */
  public clear(): void {
    this.evidenceStore.clear();
  }
}

export const provenanceService = new ProvenanceService();
