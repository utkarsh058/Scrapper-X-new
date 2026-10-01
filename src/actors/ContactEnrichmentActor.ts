import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithCrawl } from './WebsiteCrawlerActor';
import { ContactItem, SocialLinks } from '@/models/Lead';
import { normalizePhone } from '@/utils/phoneUtils';
import { normalizeEmail } from '@/utils/emailUtils';
import { webSearchDiscoveryProvider } from '@/providers/WebSearchDiscoveryProvider';

export interface BusinessWithEnrichedContacts extends BusinessWithCrawl {
  contacts: ContactItem[];
  whatsapp?: string;
  contactPage?: string;
  contactForm?: string;
  socialLinks: SocialLinks;
  wasEnriched?: boolean;
}

export interface ContactEnrichmentOutput {
  businesses: BusinessWithEnrichedContacts[];
  totalWithContact: number;
  enrichedCount: number;
}

export class ContactEnrichmentActor extends BaseActor<BusinessWithCrawl[], ContactEnrichmentOutput> {
  readonly actorId = 'actor_contact_enrichment';
  readonly name = 'Multi-Tier Contact Enrichment Actor';
  readonly timeoutMs = 60000;

  protected async run(context: ActorContext<BusinessWithCrawl[]>): Promise<{
    data: ContactEnrichmentOutput;
    sources: string[];
  }> {
    const businesses = context.input;
    context.onProgress?.(`Enriching contacts across ${businesses.length} businesses using prioritized legitimate public sources...`);

    let withContactCount = 0;
    let newlyEnrichedCount = 0;
    const activeSources = new Set<string>();

    const enrichedList: BusinessWithEnrichedContacts[] = [];
    const BATCH_SIZE = 10;

    // Process businesses in concurrent batches of BATCH_SIZE
    for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
      const chunk = businesses.slice(i, i + BATCH_SIZE);

      const processedChunk = await Promise.all(
        chunk.map(async (b) => {
          const contacts: ContactItem[] = [];
          const socialLinks: SocialLinks = { ...(b.crawlResult?.socialLinks || {}) };
          let newlyEnriched = false;

          // --- TIER 1: Existing trusted phone/email from initial discovery source ---
          const sourcePhone = normalizePhone(b.phone);
          if (sourcePhone) {
            contacts.push({
              value: sourcePhone,
              type: 'phone',
              source: b.source || 'osm',
              sourceType: b.source || 'osm',
              sourceUrl: b.sourceUrl,
              confidence: 'verified',
              verified: true,
            });
            activeSources.add(b.source || 'osm');
          }

          const sourceEmail = normalizeEmail(b.email);
          if (sourceEmail) {
            contacts.push({
              value: sourceEmail,
              type: 'email',
              source: b.source || 'osm',
              sourceType: b.source || 'osm',
              sourceUrl: b.sourceUrl,
              confidence: 'verified',
              verified: true,
            });
            activeSources.add(b.source || 'osm');
          }

          // --- TIER 2: Official business website crawl (if available) ---
          if (b.crawlResult) {
            for (const rawEmail of b.crawlResult.extractedEmails) {
              const norm = normalizeEmail(rawEmail);
              if (norm && !contacts.some((c) => c.value.toLowerCase() === norm)) {
                contacts.push({
                  value: norm,
                  type: 'email',
                  source: 'official_website',
                  sourceType: 'website',
                  sourceUrl: b.crawlResult.finalUrl,
                  confidence: 'verified',
                  verified: true,
                });
                activeSources.add('official_website');
                if (!sourceEmail) newlyEnriched = true;
              }
            }

            for (const rawPhone of b.crawlResult.extractedPhones) {
              const norm = normalizePhone(rawPhone);
              if (norm && !contacts.some((c) => c.value === norm)) {
                contacts.push({
                  value: norm,
                  type: 'phone',
                  source: 'official_website',
                  sourceType: 'website',
                  sourceUrl: b.crawlResult.finalUrl,
                  confidence: 'verified',
                  verified: true,
                });
                activeSources.add('official_website');
                if (!sourcePhone) newlyEnriched = true;
              }
            }
          }

          // --- TIER 3: Targeted Public Web Search Contact Enrichment ---
          // If business still lacks phone or email, query public web index
          const hasPhoneNow = contacts.some((c) => c.type === 'phone' || c.type === 'mobile');
          const hasEmailNow = contacts.some((c) => c.type === 'email');

          if (!hasPhoneNow || !hasEmailNow) {
            try {
              // Safety timeout per candidate (2500ms max)
              const enrichPromise = webSearchDiscoveryProvider.enrichBusinessContacts(
                b.businessName,
                b.city,
                b.state,
                b.category
              );
              const timeoutPromise = new Promise<any>((resolve) => setTimeout(() => resolve({}), 2500));
              const webEnrich = await Promise.race([enrichPromise, timeoutPromise]);

              if (!hasPhoneNow && webEnrich.phone) {
                contacts.push({
                  value: webEnrich.phone,
                  type: 'phone',
                  source: 'web_search',
                  sourceType: 'search_snippet',
                  sourceUrl: webEnrich.sourceUrl,
                  confidence: webEnrich.confidence || 'high',
                  verified: true,
                });
                activeSources.add('web_search');
                newlyEnriched = true;
              }

              if (!hasEmailNow && webEnrich.email) {
                contacts.push({
                  value: webEnrich.email,
                  type: 'email',
                  source: 'web_search',
                  sourceType: 'search_snippet',
                  sourceUrl: webEnrich.sourceUrl,
                  confidence: webEnrich.confidence || 'high',
                  verified: true,
                });
                activeSources.add('web_search');
                newlyEnriched = true;
              }
            } catch {
              // Failure of public search enrichment does not fail the business
            }
          }

          // Primary contact resolution
          const primaryPhone = contacts.find((c) => c.type === 'phone' || c.type === 'mobile')?.value || sourcePhone;
          const primaryEmail = contacts.find((c) => c.type === 'email')?.value || sourceEmail;

          const whatsapp = b.crawlResult?.ctas.hasWhatsAppCTA ? 'Available on website' : undefined;
          const contactForm = b.crawlResult?.ctas.hasContactForm ? 'Available on website' : undefined;
          const contactPage = b.crawlResult?.pages.find((p) => /contact/i.test(p.url))?.url;

          return {
            ...b,
            phone: primaryPhone,
            email: primaryEmail,
            whatsapp,
            contactPage,
            contactForm,
            socialLinks,
            contacts,
            wasEnriched: newlyEnriched,
          };
        })
      );

      for (const item of processedChunk) {
        if (item.phone || item.email) withContactCount++;
        if (item.wasEnriched) newlyEnrichedCount++;
        enrichedList.push(item);
      }
    }

    context.onProgress?.(
      `Contact enrichment complete: ${withContactCount} businesses with verified phone or email (${newlyEnrichedCount} newly enriched from public sources).`,
      withContactCount
    );

    return {
      data: {
        businesses: enrichedList,
        totalWithContact: withContactCount,
        enrichedCount: newlyEnrichedCount,
      },
      sources: Array.from(activeSources),
    };
  }
}

export const contactEnrichmentActor = new ContactEnrichmentActor();
