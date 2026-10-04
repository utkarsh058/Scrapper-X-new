/**
 * Contact Enrichment & Verification Pipeline for LeadPilot
 * 
 * Flow:
 *   Business
 *     → Google Places contact fields
 *     → OSM contact fields
 *     → Official website discovery
 *     → Website homepage → Contact page → About page → Footer
 *     → Public contact extraction (mailto, tel, JSON-LD, visible text)
 *     → Normalization
 *     → Deduplication
 *     → Contact persistence
 *     → Phone verification (libphonenumber → Twilio Lookup)
 *     → Email verification (syntax → DNS MX → ZeroBounce)
 *     → Quality scoring
 * 
 * ABSOLUTE RULES:
 * - NO FAKE DATA
 * - NO MOCK CONTACTS
 * - NO FABRICATED EMAILS / PHONE NUMBERS
 * - If contact cannot be verified → mark UNVERIFIED or UNAVAILABLE
 * - Never invent info@, contact@, sales@ unless actually found
 */
import { normalizePhone } from '@/utils/phoneUtils';
import { normalizeEmail, extractEmailsFromWebsite } from '@/utils/emailUtils';
import {
  CanonicalContact,
  ContactVerificationStatus,
  ContactQualityAssessment,
  assessContactQuality,
} from './contactTypes';
import { phoneVerificationService, PhoneVerificationResult } from './phoneVerificationProvider';
import { emailVerificationService, EmailVerificationResult } from './emailVerificationProvider2';
import {
  persistContacts,
  persistPhoneVerification,
  persistEmailVerification,
  getBusinessContacts,
} from './contactPersistence';

// ─── Input/Output Types ─────────────────────────────────────

export interface ContactEnrichmentInput {
  businessId: string;
  businessName: string;
  // Existing data from discovery
  phone?: string;
  email?: string;
  websiteUrl?: string;
  // Source provenance
  source: string;          // google_places | osm | stored
  sourceUrl?: string;
  // Crawl results (if website was crawled)
  crawlResult?: {
    extractedEmails: string[];
    extractedPhones: string[];
    finalUrl?: string;
    pages?: { url: string; emails: string[]; phones: string[] }[];
    socialLinks?: Record<string, string>;
    ctas?: { hasWhatsAppCTA?: boolean; hasContactForm?: boolean };
    jsonLdEmails?: string[];
    jsonLdPhones?: string[];
  };
  skipLiveWebCrawl?: boolean;
  skipPersistence?: boolean;
}

export interface ContactEnrichmentOutput {
  contacts: CanonicalContact[];
  quality: ContactQualityAssessment;
  phoneVerificationResults: PhoneVerificationResult[];
  emailVerificationResults: EmailVerificationResult[];
  enrichedFromWebsite: boolean;
  contactsPersistedCount: number;
}

// ─── Contact Enrichment Pipeline ────────────────────────────

const VERIFICATION_CONCURRENCY = 10;

export class ContactEnrichmentPipeline {

  /**
   * Enriches and verifies contacts for a single business.
   * 
   * 1. Collects contacts from all sources
   * 2. Normalizes and deduplicates
   * 3. Persists to PostgreSQL
   * 4. Verifies phones and emails
   * 5. Returns quality assessment
   */
  async enrichAndVerify(input: ContactEnrichmentInput): Promise<ContactEnrichmentOutput> {
    const rawContacts: CanonicalContact[] = [];
    let enrichedFromWebsite = false;

    // ─── TIER 1: Discovery source contacts ──────────
    if (input.phone) {
      const normPhone = normalizePhone(input.phone);
      if (normPhone) {
        rawContacts.push({
          contactType: 'PHONE',
          rawValue: input.phone,
          normalizedValue: normPhone,
          source: input.source,
          sourceUrl: input.sourceUrl,
          sourceProvider: input.source,
          confidence: 0.5,  // Unverified discovery data
          verificationStatus: 'UNVERIFIED',
          isPrimary: true,
          isPublic: true,
          isRoleBased: false,
          isDisposable: false,
          evidence: `Phone from ${input.source}: ${input.phone}`,
        });
      }
    }

    if (input.email) {
      const normEmail = normalizeEmail(input.email);
      if (normEmail) {
        rawContacts.push({
          contactType: 'EMAIL',
          rawValue: input.email,
          normalizedValue: normEmail,
          domain: normEmail.split('@')[1],
          source: input.source,
          sourceUrl: input.sourceUrl,
          sourceProvider: input.source,
          confidence: 0.5,
          verificationStatus: 'UNVERIFIED',
          isPrimary: true,
          isPublic: true,
          isRoleBased: false,
          isDisposable: false,
          evidence: `Email from ${input.source}: ${input.email}`,
        });
      }
    }

    // ─── TIER 2: Website crawl results ──────────────
    if (input.crawlResult) {
      const crawl = input.crawlResult;

      // Phones from crawl
      for (const rawPhone of crawl.extractedPhones) {
        const norm = normalizePhone(rawPhone);
        if (norm && !rawContacts.some(c => c.contactType === 'PHONE' && c.normalizedValue === norm)) {
          rawContacts.push({
            contactType: 'PHONE',
            rawValue: rawPhone,
            normalizedValue: norm,
            source: 'official_website',
            sourceUrl: crawl.finalUrl || input.websiteUrl,
            sourceProvider: 'website_crawler',
            confidence: 0.5,
            verificationStatus: 'UNVERIFIED',
            isPrimary: rawContacts.filter(c => c.contactType === 'PHONE').length === 0,
            isPublic: true,
            isRoleBased: false,
            isDisposable: false,
            evidence: `Phone from website: ${rawPhone}`,
          });
          enrichedFromWebsite = true;
        }
      }

      // Emails from crawl
      for (const rawEmail of crawl.extractedEmails) {
        const norm = normalizeEmail(rawEmail);
        if (norm && !rawContacts.some(c => c.contactType === 'EMAIL' && c.normalizedValue === norm)) {
          rawContacts.push({
            contactType: 'EMAIL',
            rawValue: rawEmail,
            normalizedValue: norm,
            domain: norm.split('@')[1],
            source: 'official_website',
            sourceUrl: crawl.finalUrl || input.websiteUrl,
            sourceProvider: 'website_crawler',
            confidence: 0.5,
            verificationStatus: 'UNVERIFIED',
            isPrimary: rawContacts.filter(c => c.contactType === 'EMAIL').length === 0,
            isPublic: true,
            isRoleBased: false,
            isDisposable: false,
            evidence: `Email from website: ${rawEmail}`,
          });
          enrichedFromWebsite = true;
        }
      }

      // JSON-LD structured data contacts
      if (crawl.jsonLdEmails) {
        for (const e of crawl.jsonLdEmails) {
          const norm = normalizeEmail(e);
          if (norm && !rawContacts.some(c => c.contactType === 'EMAIL' && c.normalizedValue === norm)) {
            rawContacts.push({
              contactType: 'EMAIL',
              rawValue: e,
              normalizedValue: norm,
              domain: norm.split('@')[1],
              source: 'official_website',
              sourceUrl: crawl.finalUrl || input.websiteUrl,
              sourceProvider: 'json_ld',
              confidence: 0.6,
              verificationStatus: 'UNVERIFIED',
              isPrimary: rawContacts.filter(c => c.contactType === 'EMAIL').length === 0,
              isPublic: true,
              isRoleBased: false,
              isDisposable: false,
              evidence: `Email from JSON-LD structured data: ${e}`,
            });
            enrichedFromWebsite = true;
          }
        }
      }

      if (crawl.jsonLdPhones) {
        for (const p of crawl.jsonLdPhones) {
          const norm = normalizePhone(p);
          if (norm && !rawContacts.some(c => c.contactType === 'PHONE' && c.normalizedValue === norm)) {
            rawContacts.push({
              contactType: 'PHONE',
              rawValue: p,
              normalizedValue: norm,
              source: 'official_website',
              sourceUrl: crawl.finalUrl || input.websiteUrl,
              sourceProvider: 'json_ld',
              confidence: 0.6,
              verificationStatus: 'UNVERIFIED',
              isPrimary: rawContacts.filter(c => c.contactType === 'PHONE').length === 0,
              isPublic: true,
              isRoleBased: false,
              isDisposable: false,
              evidence: `Phone from JSON-LD structured data: ${p}`,
            });
            enrichedFromWebsite = true;
          }
        }
      }

      // WhatsApp CTA
      if (crawl.ctas?.hasWhatsAppCTA) {
        rawContacts.push({
          contactType: 'WHATSAPP',
          rawValue: 'Available on website',
          normalizedValue: 'whatsapp_available',
          source: 'official_website',
          sourceUrl: crawl.finalUrl || input.websiteUrl,
          sourceProvider: 'website_crawler',
          confidence: 0.5,
          verificationStatus: 'UNVERIFIED',
          isPrimary: false,
          isPublic: true,
          isRoleBased: false,
          isDisposable: false,
          evidence: 'WhatsApp CTA detected on website',
        });
      }

      // Contact form
      if (crawl.ctas?.hasContactForm) {
        rawContacts.push({
          contactType: 'CONTACT_FORM',
          rawValue: 'Available on website',
          normalizedValue: 'contact_form_available',
          source: 'official_website',
          sourceUrl: crawl.finalUrl || input.websiteUrl,
          sourceProvider: 'website_crawler',
          confidence: 0.5,
          verificationStatus: 'UNVERIFIED',
          isPrimary: false,
          isPublic: true,
          isRoleBased: false,
          isDisposable: false,
          evidence: 'Contact form detected on website',
        });
      }
    }

    // ─── TIER 3: Live website email extraction (if no email from Tier 1/2) ──
    const hasEmail = rawContacts.some(c => c.contactType === 'EMAIL');
    if (!hasEmail && input.websiteUrl && !input.skipLiveWebCrawl) {
      try {
        const extraction = await extractEmailsFromWebsite(input.websiteUrl);
        for (const email of extraction.emails) {
          const norm = normalizeEmail(email);
          if (norm && !rawContacts.some(c => c.contactType === 'EMAIL' && c.normalizedValue === norm)) {
            rawContacts.push({
              contactType: 'EMAIL',
              rawValue: email,
              normalizedValue: norm,
              domain: norm.split('@')[1],
              source: 'official_website',
              sourceUrl: extraction.sourceUrl || input.websiteUrl,
              sourceProvider: 'email_extractor',
              confidence: 0.5,
              verificationStatus: 'UNVERIFIED',
              isPrimary: rawContacts.filter(c => c.contactType === 'EMAIL').length === 0,
              isPublic: true,
              isRoleBased: false,
              isDisposable: false,
              evidence: `Email extracted from website: ${email} (source: ${extraction.sourceUrl})`,
            });
            enrichedFromWebsite = true;
          }
        }
      } catch {
        // Non-fatal — website email extraction failure
      }
    }

    // ─── PERSIST CONTACTS ───────────────────────────
    let contactsPersistedCount = 0;
    if (!input.skipPersistence && input.businessId && rawContacts.length > 0) {
      try {
        const persistResult = await persistContacts({
          businessId: input.businessId,
          businessName: input.businessName,
          contacts: rawContacts,
        });
        contactsPersistedCount = persistResult.persisted;
      } catch {
        // Non-fatal — persistence failure
      }
    }

    // ─── PHONE VERIFICATION ─────────────────────────
    const phoneContacts = rawContacts.filter(c => c.contactType === 'PHONE');
    const phoneResults: PhoneVerificationResult[] = [];

    for (let i = 0; i < phoneContacts.length; i += VERIFICATION_CONCURRENCY) {
      const batch = phoneContacts.slice(i, i + VERIFICATION_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (contact) => {
          try {
            const result = await phoneVerificationService.verifyPhone(contact.normalizedValue);
            // Update the contact's verification status
            contact.verificationStatus = result.verificationStatus;
            contact.confidence = result.confidence;
            contact.lineType = result.lineType;
            contact.countryCode = result.countryCode;

            // Update normalized value to E.164 if available
            if (result.normalizedE164) {
              contact.normalizedValue = result.normalizedE164;
            }

            return result;
          } catch {
            return null;
          }
        })
      );
      phoneResults.push(...batchResults.filter((r): r is PhoneVerificationResult => r !== null));
    }

    // ─── EMAIL VERIFICATION ─────────────────────────
    const emailContacts = rawContacts.filter(c => c.contactType === 'EMAIL');
    const emailResults: EmailVerificationResult[] = [];

    for (let i = 0; i < emailContacts.length; i += VERIFICATION_CONCURRENCY) {
      const batch = emailContacts.slice(i, i + VERIFICATION_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (contact) => {
          try {
            const result = await emailVerificationService.verifyEmail(contact.normalizedValue);
            // Update the contact's verification status
            contact.verificationStatus = result.verificationStatus;
            contact.confidence = result.confidence;
            contact.isRoleBased = result.isRoleBased;
            contact.isDisposable = result.isDisposable;

            return result;
          } catch {
            return null;
          }
        })
      );
      emailResults.push(...batchResults.filter((r): r is EmailVerificationResult => r !== null));
    }

    // ─── PERSIST VERIFICATION RESULTS ───────────────
    if (!input.skipPersistence && input.businessId) {
      try {
        const dbContacts = await getBusinessContacts(input.businessId);
        
        // Match and persist phone verifications
        for (const result of phoneResults) {
          const matchContact = dbContacts.find(c =>
            c.contactType === 'PHONE' &&
            (c.normalizedValue === result.normalizedE164 || c.normalizedValue === result.rawPhone)
          );
          // We get the actual contact ID from DB
          if (matchContact) {
            const dbRecord = await import('@/lib/prisma').then(m =>
              m.prisma.contact.findFirst({
                where: {
                  businessId: input.businessId,
                  contactType: 'PHONE',
                  normalizedValue: matchContact.normalizedValue,
                },
              })
            );
            if (dbRecord) {
              await persistPhoneVerification(dbRecord.id, result);
            }
          }
        }

        // Match and persist email verifications
        for (const result of emailResults) {
          const matchContact = dbContacts.find(c =>
            c.contactType === 'EMAIL' && c.normalizedValue === result.normalizedEmail
          );
          if (matchContact) {
            const dbRecord = await import('@/lib/prisma').then(m =>
              m.prisma.contact.findFirst({
                where: {
                  businessId: input.businessId,
                  contactType: 'EMAIL',
                  normalizedValue: matchContact.normalizedValue,
                },
              })
            );
            if (dbRecord) {
              await persistEmailVerification(dbRecord.id, result);
            }
          }
        }
      } catch {
        // Non-fatal — verification persistence failure
      }
    }

    // ─── QUALITY ASSESSMENT ─────────────────────────
    const quality = assessContactQuality(rawContacts);

    return {
      contacts: rawContacts,
      quality,
      phoneVerificationResults: phoneResults,
      emailVerificationResults: emailResults,
      enrichedFromWebsite,
      contactsPersistedCount,
    };
  }

  /**
   * Batch enrichment for multiple businesses with controlled concurrency.
   */
  async enrichBatch(
    inputs: ContactEnrichmentInput[],
    concurrency: number = 10
  ): Promise<Map<string, ContactEnrichmentOutput>> {
    const results = new Map<string, ContactEnrichmentOutput>();

    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (input) => {
          try {
            const result = await this.enrichAndVerify(input);
            return { businessId: input.businessId, result };
          } catch {
            return null;
          }
        })
      );

      for (const item of batchResults) {
        if (item) {
          results.set(item.businessId, item.result);
        }
      }
    }

    return results;
  }

  /**
   * Returns the status of all verification providers.
   */
  getProviderStatuses() {
    return {
      phoneVerification: phoneVerificationService.getProviderStatus(),
      emailVerification: emailVerificationService.getProviderStatus(),
    };
  }
}

export const contactEnrichmentPipeline = new ContactEnrichmentPipeline();
