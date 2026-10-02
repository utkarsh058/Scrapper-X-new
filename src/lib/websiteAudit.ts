import { WebsiteStatus } from '@/types';

export interface WebsiteAuditResult {
  hasWebsite: boolean;
  url?: string;
  status: WebsiteStatus;
  detectedIssues: string[];
  publicEmail?: string;
  speedScore?: number;
  mobileOptimized?: boolean;
  sslSecure?: boolean;
}

/**
 * Perform automated technical & usability check on a business website.
 * Never labels "poor" based on subjective AI; detects measurable technical attributes.
 */
export async function auditBusinessWebsite(rawUrl?: string): Promise<WebsiteAuditResult> {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return {
      hasWebsite: false,
      status: 'No Website',
      detectedIssues: [],
    };
  }

  let formattedUrl = rawUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const isHttps = formattedUrl.startsWith('https://');
  const detectedIssues: string[] = [];

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second cutoff for fast search responses

  try {
    const response = await fetch(formattedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (LeadPilot Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 404 || response.status >= 500) {
        return {
          hasWebsite: true,
          url: formattedUrl,
          status: 'Website Unreachable',
          detectedIssues: [`Server returned HTTP ${response.status}`],
          sslSecure: isHttps,
        };
      }
      detectedIssues.push(`HTTP status returned: ${response.status}`);
    }

    if (!isHttps) {
      detectedIssues.push('Not using secure HTTPS encryption');
    }

    // Measure loading latency
    if (duration > 2800) {
      detectedIssues.push(`Slow server response time (${(duration / 1000).toFixed(1)}s)`);
    }

    // Inspect HTML structure for mobile viewport, forms, CTA, and public emails
    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    // 1. Mobile viewport test
    const hasViewport = lowerHtml.includes('<meta name="viewport"') || lowerHtml.includes("<meta name='viewport'");
    if (!hasViewport) {
      detectedIssues.push('Missing mobile viewport configuration (Not mobile optimized)');
    }

    // 2. Interactive forms / Contact form test
    const hasForm = lowerHtml.includes('<form') || lowerHtml.includes('contact-form') || lowerHtml.includes('booking');
    if (!hasForm) {
      detectedIssues.push('No contact form or lead capture form found');
    }

    // 3. Clear Call to Action (CTA) test
    const hasCta = lowerHtml.includes('book') || lowerHtml.includes('appointment') || lowerHtml.includes('order') || lowerHtml.includes('reserve') || lowerHtml.includes('contact us');
    if (!hasCta) {
      detectedIssues.push('Missing prominent appointment / booking CTA');
    }

    // 4. Try discovering a public business email from mailto: or common footer patterns
    let discoveredEmail: string | undefined = undefined;
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch && mailtoMatch[1]) {
      const email = mailtoMatch[1].trim().toLowerCase();
      // filter out common image/dummy assets
      if (!email.includes('example.com') && !email.includes('wixpress') && !email.includes('sentry') && !email.includes('.png')) {
        discoveredEmail = email;
      }
    }

    if (!discoveredEmail) {
      const rawEmailMatch = html.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/);
      if (rawEmailMatch && rawEmailMatch[0]) {
        const email = rawEmailMatch[0].trim().toLowerCase();
        if (!email.includes('example.com') && !email.includes('wixpress') && !email.includes('domain.com') && !email.endsWith('.png')) {
          discoveredEmail = email;
        }
      }
    }

    // Determine website status
    let status: WebsiteStatus = 'Website Available';
    if (detectedIssues.length > 0) {
      status = 'Needs Website Improvement';
    }

    // Do not fabricate speed scores from HTTP response duration
    const speedScore = undefined;

    return {
      hasWebsite: true,
      url: formattedUrl,
      status,
      detectedIssues,
      publicEmail: discoveredEmail,
      speedScore,
      mobileOptimized: hasViewport,
      sslSecure: isHttps,
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      hasWebsite: true,
      url: formattedUrl,
      status: 'Website Unreachable',
      detectedIssues: [error.name === 'AbortError' ? 'Website connection timed out (>4s)' : 'Domain unreachable or SSL failure'],
      sslSecure: isHttps,
    };
  }
}
