import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if an IPv4 address is in a private, loopback, or link-local range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback or unique local.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true; // Link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // Unique local
  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedUrl?: string;
}

/**
 * Validates a URL against Server-Side Request Forgery (SSRF) risks.
 */
export async function validateUrlForSsrf(rawUrl: string): Promise<UrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    let urlWithProtocol = rawUrl.trim();
    if (!/^https?:\/\//i.test(urlWithProtocol)) {
      urlWithProtocol = `https://${urlWithProtocol}`;
    }
    parsed = new URL(urlWithProtocol);
  } catch {
    return { valid: false, reason: 'Malformed URL syntax' };
  }

  // Only allow http: and https: protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Disallowed protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Block localhost and standard loopback identifiers
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254'
  ) {
    return { valid: false, reason: 'Access to localhost and internal domain names is blocked.' };
  }

  // If hostname is directly an IP literal
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, reason: `Target IP ${hostname} is in a private or restricted network range.` };
    }
  }

  // Resolve hostname via DNS to check underlying IP
  try {
    const lookup = await dnsLookup(hostname, { all: false });
    if (lookup.family === 4 && isPrivateIPv4(lookup.address)) {
      return { valid: false, reason: `Domain ${hostname} resolves to restricted private IP: ${lookup.address}` };
    }
    if (lookup.family === 6 && isPrivateIPv6(lookup.address)) {
      return { valid: false, reason: `Domain ${hostname} resolves to restricted IPv6 address: ${lookup.address}` };
    }
  } catch (err: any) {
    // If DNS resolution fails, domain doesn't exist
    return { valid: false, reason: `DNS resolution failed for ${hostname}: ${err.message || 'Domain not found'}` };
  }

  return {
    valid: true,
    sanitizedUrl: parsed.toString(),
  };
}

/**
 * SSRF-Safe fetch wrapper. Validates target URL and rejects private network destinations.
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const check = await validateUrlForSsrf(url);
  if (!check.valid || !check.sanitizedUrl) {
    throw new Error(`[SSRF Blocked] Request to ${url} rejected: ${check.reason}`);
  }

  return fetch(check.sanitizedUrl, {
    ...init,
    redirect: 'follow',
  });
}
