import { SocialLinks } from '@/models/Lead';

export interface CrawledPage {
  url: string;
  title: string;
  statusCode: number;
  textSnippet: string;
  headings: string[];
  links: string[];
}

export interface CrawlResult {
  providerName: string;
  originalUrl: string;
  finalUrl: string;
  statusCode: number;
  isHttps: boolean;
  loadTimeMs: number;
  pageSizeBytes: number;
  pages: CrawledPage[];
  extractedEmails: string[];
  extractedPhones: string[];
  socialLinks: SocialLinks;
  extractedServices: string[];
  ctas: {
    hasPhoneCTA: boolean;
    hasEmailCTA: boolean;
    hasWhatsAppCTA: boolean;
    hasBookingCTA: boolean;
    hasContactForm: boolean;
  };
  meta: {
    title?: string;
    description?: string;
    hasViewport: boolean;
    hasCanonical: boolean;
    hasSchema: boolean;
    hasRobotsMeta: boolean;
  };
  crawledAt: string;
}

export interface WebsiteCrawlerProvider {
  readonly providerId: string;
  readonly name: string;

  crawlWebsite(targetUrl: string, maxPages?: number): Promise<CrawlResult>;
}
