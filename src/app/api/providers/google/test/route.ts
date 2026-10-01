import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic test endpoint for Google Places API (New).
 * Executes exactly ONE real Google Places request and returns sanitized provider diagnostics.
 * Crucial: NEVER exposes GOOGLE_PLACES_API_KEY.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || 'restaurants in Noida, Uttar Pradesh, India';

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const isEnabled = process.env.GOOGLE_PLACES_ENABLED !== 'false';
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);

  if (!isEnabled) {
    return NextResponse.json({
      query,
      configured: isConfigured,
      reachable: false,
      status: 'DISABLED',
      error: 'Google Places provider is explicitly disabled via GOOGLE_PLACES_ENABLED=false.',
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }

  if (!isConfigured || !apiKey) {
    return NextResponse.json({
      query,
      configured: false,
      reachable: false,
      status: 'NOT_CONFIGURED',
      error: 'GOOGLE_PLACES_API_KEY is not configured in .env.local or environment variables.',
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }

  const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount';
  const url = 'https://places.googleapis.com/v1/places:searchText';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const raw = await res.text();

    if (!res.ok) {
      let sanitizedError = `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(raw);
        if (errorJson?.error?.message) {
          sanitizedError = `${sanitizedError}: ${errorJson.error.message}`;
        }
      } catch {
        sanitizedError = `${sanitizedError}: ${raw.slice(0, 150)}`;
      }

      // Sanitize: ensure no API key appears in output
      sanitizedError = sanitizedError.replace(new RegExp(apiKey, 'g'), '[REDACTED]');

      return NextResponse.json({
        query,
        configured: true,
        reachable: false,
        status: res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : res.status === 429 ? 'QUOTA_EXCEEDED' : 'HTTP_ERROR',
        statusCode: res.status,
        durationMs,
        totalDiscovered: 0,
        error: sanitizedError,
        testedAt: new Date().toISOString(),
      }, { status: 200 });
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        query,
        configured: true,
        reachable: false,
        status: 'PARSE_ERROR',
        durationMs,
        error: 'Received non-JSON response from Google Places API',
        testedAt: new Date().toISOString(),
      }, { status: 200 });
    }

    const places = Array.isArray(data?.places) ? data.places : [];
    const placesSample = places.slice(0, 3).map((p: any) => ({
      id: p.id,
      displayName: p.displayName?.text || null,
      formattedAddress: p.formattedAddress || null,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
      websiteUri: p.websiteUri || null,
      rating: p.rating || null,
      userRatingCount: p.userRatingCount || null,
    }));

    return NextResponse.json({
      query,
      configured: true,
      reachable: true,
      status: 'READY',
      statusCode: 200,
      durationMs,
      totalDiscovered: places.length,
      placesSample,
      error: null,
      testedAt: new Date().toISOString(),
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const isTimeout = fetchErr.name === 'AbortError' || String(fetchErr.message).includes('abort');

    return NextResponse.json({
      query,
      configured: true,
      reachable: false,
      status: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      durationMs,
      totalDiscovered: 0,
      error: isTimeout ? `Request timed out after 4000ms` : (fetchErr.message || 'Unknown network error'),
      testedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}
