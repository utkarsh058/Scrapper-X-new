import { NextResponse } from 'next/server';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';

export async function GET() {
  const health = providerHealthService.checkHealth();

  const googleConfigured = Boolean(health.googlePlaces.configured && health.googlePlaces.enabled);
  let googleStatus: 'READY' | 'NOT_CONFIGURED' | 'DISABLED' | 'AUTH_ERROR' | 'QUOTA_EXCEEDED' | 'TIMEOUT' | 'NETWORK_ERROR' = 'READY';

  if (!health.googlePlaces.enabled) {
    googleStatus = 'DISABLED';
  } else if (!health.googlePlaces.configured) {
    googleStatus = 'NOT_CONFIGURED';
  } else if (!health.googlePlaces.healthy) {
    const reason = health.googlePlaces.reason || '';
    if (reason.includes('QUOTA')) googleStatus = 'QUOTA_EXCEEDED';
    else if (reason.includes('TIMEOUT')) googleStatus = 'TIMEOUT';
    else if (reason.includes('AUTH') || reason.includes('KEY')) googleStatus = 'AUTH_ERROR';
    else googleStatus = 'NETWORK_ERROR';
  }

  const osmConfigured = Boolean(health.osm.configured && health.osm.enabled);
  const osmStatus: 'READY' | 'NOT_CONFIGURED' | 'DISABLED' | 'NETWORK_ERROR' = !health.osm.enabled
    ? 'DISABLED'
    : health.osm.healthy
    ? 'READY'
    : 'NETWORK_ERROR';

  const isReachable = googleConfigured && googleStatus === 'READY';
  const errorMessage = googleStatus === 'READY' ? null : (health.googlePlaces.message || health.googlePlaces.reason || 'Provider not ready');

  return NextResponse.json({
    googlePlaces: {
      configured: googleConfigured,
      reachable: isReachable,
      status: googleStatus,
      lastCheckedAt: new Date().toISOString(),
      error: errorMessage,
    },
    osm: {
      configured: osmConfigured,
      status: osmStatus,
    },
  });
}
