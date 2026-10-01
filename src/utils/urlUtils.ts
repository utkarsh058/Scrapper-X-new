/**
 * URL Utilities for canonicalization, domain extraction, and cleaning.
 */
export function canonicalizeUrl(rawUrl?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  let trimmed = rawUrl.trim();
  if (!trimmed || trimmed.toLowerCase() === 'not available' || trimmed.toLowerCase() === 'none') {
    return undefined;
  }

  // Prepend https:// if no scheme is provided
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove default ports
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
    // Remove trailing slash if only root path
    if (parsed.pathname === '/') {
      parsed.pathname = '';
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function extractDomain(url?: string | null): string | undefined {
  const canonical = canonicalizeUrl(url);
  if (!canonical) return undefined;
  try {
    const parsed = new URL(canonical);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
}
