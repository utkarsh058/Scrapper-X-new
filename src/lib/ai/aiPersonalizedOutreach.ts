import { prisma } from '../prisma';
import { LLMProviderFactory } from './llmProvider';
import { OutreachTemplateService } from '../outreach/outreachTemplates';

export interface AIPersonalizedOutreachResult {
  success: boolean;
  isAiGenerated: boolean;
  provider: string;
  model?: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  greeting?: string;
  personalizedOpening?: string;
  businessObservation?: string;
  valueProposition?: string;
  cta?: string;
  evidenceUsed: string[];
  businessName: string;
  recipientName: string;
  fallbackReason?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class AIPersonalizedOutreachService {
  /**
   * Generates a personalized outreach message strictly grounded in real database evidence.
   */
  static async generate(leadId: string, customPromptInstruction?: string): Promise<AIPersonalizedOutreachResult> {
    const business = await prisma.business.findUnique({
      where: { id: leadId },
      include: {
        audits: { orderBy: { auditedAt: 'desc' }, take: 1 },
        contacts: { take: 2 },
        evidence: true,
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        signals: true,
      },
    });

    if (!business) {
      return {
        success: false,
        isAiGenerated: false,
        provider: 'none',
        subject: '',
        bodyText: '',
        bodyHtml: '',
        evidenceUsed: [],
        businessName: '',
        recipientName: '',
        errorCode: 'LEAD_NOT_FOUND',
        errorMessage: `Lead with ID ${leadId} not found in database.`,
      };
    }

    // 1. Gather genuine, stored evidence
    const realClaims: string[] = [];
    const audit = business.audits[0];
    if (audit?.detectedIssues) {
      try {
        const issues: string[] = JSON.parse(audit.detectedIssues);
        issues.slice(0, 3).forEach((issue) => realClaims.push(issue));
      } catch {}
    }

    business.evidence.slice(0, 3).forEach((ev) => {
      if (!realClaims.includes(ev.claim)) realClaims.push(ev.claim);
    });

    if (audit?.performanceScore) {
      realClaims.push(`Lighthouse mobile performance score: ${audit.performanceScore}/100`);
    }
    if (audit?.hasMobileViewport === false) {
      realClaims.push('Missing viewport tag for mobile devices');
    }
    if (audit?.hasBookingCta === false) {
      realClaims.push('No direct booking or appointment CTA on landing page');
    }

    if (realClaims.length === 0) {
      if (!business.websiteUrl) {
        realClaims.push('No registered official website found in local directory listings');
      } else {
        realClaims.push(`Website listed at ${business.websiteUrl} has opportunities for improved mobile lead capture`);
      }
    }

    const contact = business.contacts[0];
    const recipientName = contact?.name && contact.name !== business.name ? contact.name : business.name;
    const businessName = business.name;
    const city = business.city || '';
    const state = business.state || '';
    const category = business.category || business.industry || 'Business';
    const senderName = process.env.OUTREACH_SENDER_NAME || 'The LeadPilot Team';
    const senderCompany = process.env.OUTREACH_SENDER_COMPANY || 'LeadPilot Growth Partners';

    // 2. Check if LLM provider is configured
    const llm = LLMProviderFactory.getProvider();
    if (!llm.isConfigured()) {
      // Graceful fallback to existing evidence-grounded template
      const fallback = await OutreachTemplateService.generateMessage(leadId);
      if (!fallback) {
        return {
          success: false,
          isAiGenerated: false,
          provider: 'none',
          subject: '',
          bodyText: '',
          bodyHtml: '',
          evidenceUsed: realClaims,
          businessName,
          recipientName,
          errorCode: 'TEMPLATE_FALLBACK_FAILED',
          errorMessage: 'Both LLM and template generation could not produce message.',
        };
      }

      return {
        success: true,
        isAiGenerated: false,
        provider: 'template_fallback (LLM_NOT_CONFIGURED)',
        subject: fallback.subject,
        bodyText: fallback.bodyText,
        bodyHtml: fallback.bodyHtml,
        evidenceUsed: fallback.evidenceUsed,
        businessName,
        recipientName,
        fallbackReason: 'LLM provider not configured in environment. Used evidence-grounded template.',
      };
    }

    // 3. Construct Evidence-Grounded LLM Prompt
    const systemPrompt = `You are an elite, highly professional B2B Sales Outreach Copywriter for LeadPilot.
Your task is to write a warm, respectful, concise, and compelling cold outreach email to a business owner in India.

CRITICAL INTEGRITY RULES:
1. GROUNDED IN EVIDENCE ONLY: You MUST ONLY reference the genuine facts and evidence listed below.
2. NEVER invent awards, revenue claims, customer testimonials, employee numbers, or technologies not listed.
3. NEVER make generic spammy claims or false compliments ("I came across your amazing business!").
4. Keep the email under 130 words. Business owners are busy.
5. Provide a single, low-friction Call to Action (e.g., offering a 2-minute video preview or quick 5-minute call).
6. Format output strictly as JSON with the specified schema.`;

    const userPrompt = `Generate a personalized email for the following verified business:

BUSINESS CONTEXT:
- Business Name: ${businessName}
- Industry / Category: ${category}
- Location: ${city ? `${city}, ${state}` : 'India'}
- Website: ${business.websiteUrl || 'None listed'}
- Recipient Name: ${recipientName}
- Sender: ${senderName} (${senderCompany})
${customPromptInstruction ? `- Special Guidance: ${customPromptInstruction}` : ''}

VERIFIED EVIDENCE & AUDIT FINDINGS:
${realClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

OUTPUT SCHEMA (Return strictly JSON):
{
  "subject": "Compelling subject line under 60 characters referencing business or city",
  "greeting": "Greeting line (e.g. Hi ${recipientName},)",
  "personalizedOpening": "1 concise sentence observing their business context",
  "businessObservation": "1-2 sentences referencing 1 or 2 of the verified evidence points specifically",
  "opportunity": "How resolving this gap helps them capture more clients/leads in ${city || 'their area'}",
  "valueProposition": "Brief explanation of how we help without being pushy",
  "cta": "Low-friction question offering to share a quick preview or example",
  "closing": "Professional sign-off from ${senderName}",
  "bodyText": "Complete plain text email",
  "bodyHtml": "Complete HTML formatted email"
}`;

    try {
      const response = await llm.generateText(userPrompt, systemPrompt, { jsonMode: true });
      const rawText = response.text.trim();
      
      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Strip markdown code fences if model returned them
        const cleaned = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleaned);
      }

      // 4. Validate AI Output
      const validation = this.validateOutput(parsed, businessName);
      if (!validation.valid) {
        return {
          success: false,
          isAiGenerated: true,
          provider: llm.name,
          model: response.model,
          subject: '',
          bodyText: '',
          bodyHtml: '',
          evidenceUsed: realClaims,
          businessName,
          recipientName,
          errorCode: 'AI_OUTPUT_VALIDATION_FAILED',
          errorMessage: validation.error,
        };
      }

      return {
        success: true,
        isAiGenerated: true,
        provider: llm.name,
        model: response.model,
        subject: parsed.subject.trim(),
        bodyText: parsed.bodyText.trim(),
        bodyHtml: parsed.bodyHtml ? parsed.bodyHtml.trim() : parsed.bodyText.replace(/\n/g, '<br />'),
        greeting: parsed.greeting,
        personalizedOpening: parsed.personalizedOpening,
        businessObservation: parsed.businessObservation,
        valueProposition: parsed.valueProposition,
        cta: parsed.cta,
        evidenceUsed: realClaims,
        businessName,
        recipientName,
      };
    } catch (err: any) {
      return {
        success: false,
        isAiGenerated: false,
        provider: llm.name,
        subject: '',
        bodyText: '',
        bodyHtml: '',
        evidenceUsed: realClaims,
        businessName,
        recipientName,
        errorCode: 'AI_GENERATION_FAILED',
        errorMessage: err.message || 'LLM text generation failed.',
      };
    }
  }

  private static validateOutput(parsed: any, businessName: string): { valid: boolean; error?: string } {
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'AI output was not a valid JSON object.' };
    }
    if (!parsed.subject || typeof parsed.subject !== 'string' || parsed.subject.trim().length === 0) {
      return { valid: false, error: 'AI output missing subject line.' };
    }
    if (!parsed.bodyText || typeof parsed.bodyText !== 'string' || parsed.bodyText.trim().length < 40) {
      return { valid: false, error: 'AI output bodyText is too short or empty.' };
    }
    if (parsed.subject.length > 150) {
      return { valid: false, error: 'AI subject line is excessively long.' };
    }

    const forbiddenPlaceholders = ['[insert', '[company', '[business', '[your name', '{company}', 'lorem ipsum'];
    const lowerBody = parsed.bodyText.toLowerCase();
    for (const ph of forbiddenPlaceholders) {
      if (lowerBody.includes(ph)) {
        return { valid: false, error: `AI output contains un-substituted placeholder: "${ph}".` };
      }
    }

    return { valid: true };
  }
}
