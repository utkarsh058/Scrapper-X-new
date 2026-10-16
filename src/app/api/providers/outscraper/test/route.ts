import { NextRequest, NextResponse } from 'next/server';
import { OutscraperDiscoveryProvider } from '@/providers/OutscraperDiscoveryProvider';

/**
 * Diagnostic test endpoint for Outscraper Google Maps Engine.
 * Executes a single request and returns sanitized provider diagnostics.
 * Crucial: NEVER exposes OUTSCRAPER_API_KEY in the response or error output.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || 'restaurants in Noida, Uttar Pradesh, India';

  const rawKey = process.env.OUTSCRAPER_API_KEY;
  const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '').trim() : '';
  const isEnabled = process.env.OUTSCRAPER_ENABLED !== 'false';
  const isConfigured = Boolean(apiKey && apiKey.length > 0);

  if (!isEnabled) {
    return NextResponse.json({
      query,
      configured: isConfigured,
      reachable: false,
      status: 'DISABLED',
      error: 'Outscraper discovery provider is currently disabled via OUTSCRAPER_ENABLED=false.',
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }

  // Check if simulation is active (e.g., during tests)
  const simResults = OutscraperDiscoveryProvider.getSimulateResults();
  if (simResults !== null) {
    return NextResponse.json({
      query,
      configured: true,
      reachable: true,
      status: 'READY',
      statusCode: 200,
      durationMs: 45,
      totalDiscovered: simResults.length,
      placesSample: simResults.slice(0, 3).map((b) => ({
        id: b.sourceId,
        displayName: b.name,
        formattedAddress: b.address,
        phone: b.phone || null,
        websiteUri: b.website || null,
        rating: b.rating || null,
        userRatingCount: b.userRatingCount || null,
      })),
      error: null,
      simulated: true,
      testedAt: new Date().toISOString(),
    });
  }

  if (!isConfigured || !apiKey) {
    return NextResponse.json({
      query,
      configured: false,
      reachable: false,
      status: 'NOT_CONFIGURED',
      error: 'OUTSCRAPER_API_KEY is not configured in .env.local or environment variables.',
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }

  const url = new URL('https://api.outscraper.cloud/google-maps-search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '3');
  url.searchParams.set('async', 'false');
  url.searchParams.set('language', 'en');

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'LeadPilot-Engine/2.1 (diagnostic-test)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const raw = await res.text();

    if (!res.ok) {
      let sanitizedError = `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(raw);
        if (errorJson?.message) {
          sanitizedError = `${sanitizedError}: ${errorJson.message}`;
        } else if (errorJson?.error) {
          sanitizedError = `${sanitizedError}: ${typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error)}`;
        }
      } catch {
        sanitizedError = `${sanitizedError}: ${raw.slice(0, 150)}`;
      }

      // Sanitize: ensure no API key appears anywhere in output
      sanitizedError = sanitizedError.replace(new RegExp(apiKey, 'g'), '[REDACTED]');

      let status: 'AUTH_ERROR' | 'QUOTA_EXCEEDED' | 'HTTP_ERROR' = 'HTTP_ERROR';
      if (res.status === 401 || res.status === 403) {
        status = 'AUTH_ERROR';
      } else if (res.status === 402 || res.status === 429) {
        status = 'QUOTA_EXCEEDED';
      }

      return NextResponse.json({
        query,
        configured: true,
        reachable: false,
        status,
        statusCode: res.status,
        durationMs,
        totalDiscovered: 0,
        error: sanitizedError,
        testedAt: new Date().toISOString(),
      }, { status: 200 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        query,
        configured: true,
        reachable: false,
        status: 'PARSE_ERROR',
        durationMs,
        error: 'Received non-JSON response from Outscraper API',
        testedAt: new Date().toISOString(),
      }, { status: 200 });
    }

    // Outscraper standard response structure: { data: [[{ place1 }, ...]] } or { data: [{ place1 }, ...] }
    let rawItems: any[] = [];
    if (Array.isArray(parsed?.data)) {
      if (Array.isArray(parsed.data[0])) {
        rawItems = parsed.data[0];
      } else {
        rawItems = parsed.data;
      }
    } else if (Array.isArray(parsed)) {
      rawItems = parsed;
    }

    const placesSample = rawItems.slice(0, 3).map((p: any) => ({
      id: p.place_id || p.google_id || p.id || null,
      displayName: p.name || p.title || null,
      formattedAddress: p.full_address || p.address || null,
      phone: p.phone || p.phone_number || null,
      websiteUri: p.site || p.website || null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      userRatingCount: typeof p.reviews === 'number' ? p.reviews : null,
    }));

    return NextResponse.json({
      query,
      configured: true,
      reachable: true,
      status: 'READY',
      statusCode: 200,
      durationMs,
      totalDiscovered: rawItems.length,
      placesSample,
      error: null,
      testedAt: new Date().toISOString(),
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const isTimeout = fetchErr.name === 'AbortError' || String(fetchErr.message).includes('abort');

    let sanitizedMessage = fetchErr.message || 'Unknown network error';
    if (apiKey) {
      sanitizedMessage = sanitizedMessage.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
    }

    return NextResponse.json({
      query,
      configured: true,
      reachable: false,
      status: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      durationMs,
      totalDiscovered: 0,
      error: isTimeout ? 'Request timed out after 10000ms' : sanitizedMessage,
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}
