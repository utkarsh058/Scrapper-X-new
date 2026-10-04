import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';
import { provenanceService } from '@/services/evidence/ProvenanceService';

/**
 * Public LeadPilot API: Get Business Provenance / Source Evidence
 * GET /api/businesses/:businessId/provenance
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params;
    const business = businessDiscoveryService.getBusiness(businessId);

    if (!business) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Business ${businessId} not found.` },
        { status: 404 }
      );
    }

    const recordedEvidence = provenanceService.getEvidenceForEntity(businessId);
    const combinedEvidence = [...business.evidence];

    for (const rec of recordedEvidence) {
      if (!combinedEvidence.some((e) => e.field === rec.field && e.source === rec.source && e.value === rec.value)) {
        combinedEvidence.push(rec);
      }
    }

    return NextResponse.json(
      {
        businessId,
        sources: business.sources,
        evidence: combinedEvidence,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve provenance' },
      { status: 500 }
    );
  }
}
