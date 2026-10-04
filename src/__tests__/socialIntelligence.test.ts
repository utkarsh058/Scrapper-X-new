import { describe, it, expect } from 'vitest';
import { WebsiteSocialExtractor } from '@/services/social/WebsiteSocialExtractor';
import { SocialIdentityVerificationService } from '@/services/social/SocialIdentityVerificationService';
import { SocialDiscoveryService } from '@/services/social/SocialDiscoveryService';

describe('Social Media Intelligence (Section 17-26, 42)', () => {
  const extractor = new WebsiteSocialExtractor();
  const verifier = new SocialIdentityVerificationService();
  const discovery = new SocialDiscoveryService();

  const mockIdentity = {
    name: 'Spice Symphony',
    category: 'Restaurant',
    city: 'Greater Noida',
    state: 'Uttar Pradesh',
    website: 'https://spicesymphony.in',
  };

  it('extracts social links from website HTML and JSON-LD schema', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "Spice Symphony",
            "sameAs": [
              "https://www.instagram.com/spicesymphony_official",
              "https://www.facebook.com/spicesymphonydelhi"
            ]
          }
          </script>
        </head>
        <body>
          <footer>
            <a href="https://www.youtube.com/@spicesymphony">YouTube Channel</a>
            <a href="https://www.linkedin.com/company/spice-symphony">LinkedIn</a>
          </footer>
        </body>
      </html>
    `;

    const extracted = extractor.extractFromHtml(html);

    expect(extracted).toHaveLength(4);
    expect(extracted.find((e) => e.platform === 'instagram')?.username).toBe('spicesymphony_official');
    expect(extracted.find((e) => e.platform === 'facebook')?.username).toBe('spicesymphonydelhi');
    expect(extracted.find((e) => e.platform === 'youtube')?.username).toBe('spicesymphony');
    expect(extracted.find((e) => e.platform === 'linkedin')?.username).toBe('spice-symphony');
  });

  it('verifies website-extracted profiles with HIGH confidence', () => {
    const link = {
      platform: 'instagram' as const,
      url: 'https://www.instagram.com/spicesymphony_official',
      username: 'spicesymphony_official',
      source: 'website_body' as const,
    };

    const result = verifier.verify(mockIdentity, link);

    expect(result.matched).toBe(true);
    expect(result.level).toBe('HIGH');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('rejects public search candidates that have no matching city, domain, or name proof', () => {
    const candidateWrongCity = {
      platform: 'instagram' as const,
      url: 'https://www.instagram.com/spice_symphony_mumbai',
      username: 'spice_symphony_mumbai',
      source: 'public_search' as any,
      bio: 'Premier luxury dining in Bandra West, Mumbai. Call 9820000000',
    };

    const result = verifier.verify(mockIdentity, candidateWrongCity);

    // Mismatched city (Mumbai vs Greater Noida) and no domain match
    expect(result.level).toBe('LOW');
  });

  it('strictly preserves creation date boundary and null follower counts', () => {
    const html = `
      <a href="https://www.instagram.com/spicesymphony_official">Instagram</a>
    `;

    const { profiles, snapshots } = discovery.discoverFromWebsiteHtml(
      'biz_test',
      mockIdentity,
      html
    );

    expect(profiles).toHaveLength(1);
    const profile = profiles[0];

    // Strict Rule: Missing follower count is NULL, never 0
    expect(profile.followers).toBeNull();
    expect(profile.following).toBeNull();

    // Strict Rule: createdAt is NOT_AVAILABLE, not conflated with firstSeenAt
    expect(profile.createdAt).toBeNull();
    expect(profile.createdAtType).toBe('NOT_AVAILABLE');
    expect(profile.firstSeenAt).toBeInstanceOf(Date);

    // Snapshots
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].followers).toBeNull();
  });
});
