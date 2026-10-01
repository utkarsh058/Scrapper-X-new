/**
 * Shared Safe API Client for LeadPilot Frontend & Backend Requests.
 *
 * Guarantees that:
 * 1. Raw response text is inspected before any JSON parsing.
 * 2. Content-Type is validated to ensure it is application/json.
 * 3. Network and HTTP errors are cleanly caught and surfaced with debug context.
 * 4. HTML error pages (e.g. Next.js 500/404 HTML) never produce cryptic "Unexpected token '<'" errors.
 */

export interface ApiErrorDetails {
  endpoint?: string;
  status: number;
  contentType: string;
  provider?: string;
  error: string;
  rawSnippet?: string;
}

export class LeadPilotApiError extends Error {
  public details: ApiErrorDetails;

  constructor(message: string, details: ApiErrorDetails) {
    super(message);
    this.name = 'LeadPilotApiError';
    this.details = details;
  }
}

/**
 * Parses a fetch Response safely, logging debug telemetry and rejecting non-JSON or HTTP errors.
 */
export async function parseApiResponse<T = any>(
  response: Response,
  endpoint?: string
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  // Log telemetry for tracing (as requested)
  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    console.log('[LeadPilot API Trace]', {
      url: endpoint || response.url || 'unknown-url',
      status: response.status,
      contentType,
      snippet: raw.slice(0, 300),
    });
  }

  // Handle HTTP Error statuses (4xx, 5xx)
  if (!response.ok) {
    let parsedError = '';
    let parsedProvider = '';

    if (contentType.includes('application/json')) {
      try {
        const errJson = JSON.parse(raw);
        parsedError = errJson.error || errJson.message || '';
        parsedProvider = errJson.provider || errJson.providerName || '';
      } catch {
        // Fall back to raw snippet
      }
    }

    const readableMessage = parsedError
      ? `Lead search service error (${response.status}): ${parsedError}`
      : `Request failed (${response.status}): ${raw.slice(0, 300)}`;

    throw new LeadPilotApiError(readableMessage, {
      endpoint: endpoint || response.url,
      status: response.status,
      contentType,
      provider: parsedProvider,
      error: parsedError || `HTTP ${response.status}`,
      rawSnippet: raw.slice(0, 300),
    });
  }

  // Enforce Content-Type = application/json
  if (!contentType.includes('application/json')) {
    const isHtml = raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html');
    const preview = raw.slice(0, 300);

    throw new LeadPilotApiError(
      `Lead search service returned an invalid response. Expected JSON but received ${contentType || 'unknown type'} (HTTP ${response.status}).`,
      {
        endpoint: endpoint || response.url,
        status: response.status,
        contentType,
        error: isHtml
          ? 'Server returned an HTML error document instead of JSON.'
          : `Non-JSON payload (${contentType})`,
        rawSnippet: preview,
      }
    );
  }

  // Safe JSON Parsing
  try {
    return JSON.parse(raw) as T;
  } catch (parseErr: any) {
    throw new LeadPilotApiError(
      `Lead search service returned invalid JSON: ${parseErr.message}`,
      {
        endpoint: endpoint || response.url,
        status: response.status,
        contentType,
        error: parseErr.message,
        rawSnippet: raw.slice(0, 300),
      }
    );
  }
}

/**
 * Convenience helper to execute a fetch request and parse JSON safely.
 */
export async function safeFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method || 'GET';
  console.log(`[LeadPilot Request] ${method} ${url}`);

  const response = await fetch(url, init);
  return parseApiResponse<T>(response, url);
}
