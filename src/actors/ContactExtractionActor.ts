import { BaseActor, ActorContext } from '@/models/Actor';
import { BusinessWithCrawl } from './WebsiteCrawlerActor';
import { ContactItem, SocialLinks } from '@/models/Lead';
import { contactEnrichmentActor } from './ContactEnrichmentActor';

export interface BusinessWithContacts extends BusinessWithCrawl {
  contacts: ContactItem[];
  whatsapp?: string;
  contactPage?: string;
  contactForm?: string;
  socialLinks: SocialLinks;
  wasEnriched?: boolean;
}

export class ContactExtractionActor extends BaseActor<BusinessWithCrawl[], BusinessWithContacts[]> {
  readonly actorId = 'actor_contact_extraction';
  readonly name = 'Contact Extraction & Enrichment Actor';
  readonly timeoutMs = 60000;

  protected async run(context: ActorContext<BusinessWithCrawl[]>): Promise<{
    data: BusinessWithContacts[];
    sources: string[];
  }> {
    const enrichment = await contactEnrichmentActor.execute(context);
    return {
      data: enrichment.data.businesses,
      sources: enrichment.sources,
    };
  }
}

export const contactExtractionActor = new ContactExtractionActor();
