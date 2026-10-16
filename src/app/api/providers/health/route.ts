import { NextResponse } from 'next/server';
import { providerHealthService } from '@/lib/providers/ProviderHealthService';

export async function GET() {
  const health = providerHealthService.checkHealth();

  // Outscraper (Primary Discovery Provider)
  const outscraperConfigured = Boolean(health.outscraper?.configured && health.outscraper?.enabled);
  let outscraperStatus: 'READY' | 'NOT_CONFIGURED' | 'DISABLED' | 'AUTH_ERROR' | 'QUOTA_EXCEEDED' | 'TIMEOUT' | 'NETWORK_ERROR' = 'READY';

  if (!health.outscraper?.enabled) {
    outscraperStatus = 'DISABLED';
  } else if (!health.outscraper?.configured) {
    outscraperStatus = 'NOT_CONFIGURED';
  } else if (!health.outscraper?.healthy) {
    const reason = health.outscraper?.reason || '';
    if (reason.includes('QUOTA')) outscraperStatus = 'QUOTA_EXCEEDED';
    else if (reason.includes('TIMEOUT')) outscraperStatus = 'TIMEOUT';
    else if (reason.includes('AUTH') || reason.includes('KEY')) outscraperStatus = 'AUTH_ERROR';
    else outscraperStatus = 'NETWORK_ERROR';
  }

  const isOutscraperReachable = outscraperConfigured && outscraperStatus === 'READY';
  const outscraperErrorMessage =
    outscraperStatus === 'READY' ? null : health.outscraper?.message || health.outscraper?.reason || 'Provider not ready';

  // Google Places (Modular / Disabled until explicitly enabled)
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

  const isGoogleReachable = googleConfigured && googleStatus === 'READY';
  const googleErrorMessage =
    googleStatus === 'READY' ? null : health.googlePlaces.message || health.googlePlaces.reason || 'Provider not ready';

  // OpenStreetMap (Secondary / Fallback Provider)
  const osmConfigured = Boolean(health.osm.configured && health.osm.enabled);
  const osmStatus: 'READY' | 'NOT_CONFIGURED' | 'DISABLED' | 'NETWORK_ERROR' = !health.osm.enabled
    ? 'DISABLED'
    : health.osm.healthy
    ? 'READY'
    : 'NETWORK_ERROR';

  return NextResponse.json({
    primaryProvider: (process.env.PRIMARY_DISCOVERY_PROVIDER || 'outscraper').toLowerCase(),
    outscraper: {
      configured: outscraperConfigured,
      reachable: isOutscraperReachable,
      status: outscraperStatus,
      lastCheckedAt: new Date().toISOString(),
      error: outscraperErrorMessage,
    },
    googlePlaces: {
      configured: googleConfigured,
      reachable: isGoogleReachable,
      status: googleStatus,
      lastCheckedAt: new Date().toISOString(),
      error: googleErrorMessage,
    },
    osm: {
      configured: osmConfigured,
      status: osmStatus,
    },
  });
}
