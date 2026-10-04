import { NextRequest, NextResponse } from 'next/server';
import { businessDiscoveryService } from '@/services/discovery/BusinessDiscoveryService';

/**
 * Public LeadPilot API: Get Business Social Profiles (Social Intelligence V2)
 * GET /api/businesses/:businessId/social
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

    const profiles = (business.social || []).map((p) => ({
      platform: p.platform.toUpperCase(),
      profileUrl: p.profileUrl,
      username: p.username,
      verificationStatus: p.verificationStatus || (p.confidence && p.confidence >= 0.8 ? 'VERIFIED' : 'UNVERIFIED'),
      metrics: {
        followerCount: p.followers ?? null,
        displayFollowerCount: p.displayFollowerCount ?? (p.followers !== null ? p.followers.toLocaleString() : null),
        isRounded: p.isRounded ?? false,
        followingCount: p.following ?? null,
        subscriberCount: p.subscribers ?? null,
        videoCount: p.videos ?? null,
        postCount: p.posts ?? null,
        likeCount: p.likes ?? null,
      },
      metricStatus: p.metricStatus || 'NOT_CONFIGURED',
      metricSource: p.metricSource || null,
      metricSourceType: p.metricSourceType || 'NONE',
      accountCreatedAt: (p.accountCreatedAt || p.createdAt) ? (p.accountCreatedAt || p.createdAt)!.toISOString() : null,
      accountCreatedAtType: p.createdAtType || 'NOT_AVAILABLE',
      accountCreatedDatePrecision: p.accountCreatedDatePrecision ?? null,
      accountCreatedStatus: p.accountCreatedStatus || 'NOT_AVAILABLE',
      accountCreatedConfidence: p.accountCreatedConfidence ?? null,
      accountCreatedSourceType: p.accountCreatedSourceType ?? null,
      accountCreatedSourceUrl: p.accountCreatedSourceUrl ?? null,
      accountCreatedEvidenceText: p.accountCreatedEvidenceText ?? null,
      accountCreatedFetchedAt: p.accountCreatedFetchedAt ? p.accountCreatedFetchedAt.toISOString() : null,
      firstObservedAt: p.firstObservedAt ? p.firstObservedAt.toISOString() : null,
      firstObservedSourceType: p.firstObservedSourceType ?? null,
      firstObservedSourceUrl: p.firstObservedSourceUrl ?? null,
      firstObservedEvidenceText: p.firstObservedEvidenceText ?? null,
      earliestPublicPostAt: p.earliestPublicPostAt ? p.earliestPublicPostAt.toISOString() : null,
      earliestPublicPostSourceUrl: p.earliestPublicPostSourceUrl ?? null,
      fetchedAt: p.followersFetchedAt ? p.followersFetchedAt.toISOString() : null,
    }));

    return NextResponse.json(
      {
        businessId,
        profiles,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: err.message || 'Failed to retrieve social profiles' },
      { status: 500 }
    );
  }
}
