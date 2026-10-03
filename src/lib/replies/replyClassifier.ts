import { LLMProviderFactory } from '../ai/llmProvider';

export type ReplyClassificationType =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'QUESTION'
  | 'OOO'
  | 'NEEDS_INFO'
  | 'WRONG_PERSON'
  | 'UNSUBSCRIBE'
  | 'BOUNCE'
  | 'NEGOTIATION'
  | 'MEETING_REQUEST'
  | 'UNKNOWN';

export interface ClassificationResult {
  classification: ReplyClassificationType;
  confidence: number;
  reason: string;
  detectedReturnDate?: string; // For OOO
  aiDraftResponse?: string;
  model: string;
}

export class ReplyClassifier {
  /**
   * Deterministic keyword checks to guarantee high-stakes compliance and avoid LLM hallucinations.
   */
  private static checkDeterministicRules(subject: string, body: string): ClassificationResult | null {
    const combined = `${subject} ${body}`.toLowerCase();

    // 1. Unsubscribe checks
    const unsubKeywords = ['unsubscribe', 'remove me', 'stop emailing', 'opt out', 'please remove', 'do not contact', 'take me off'];
    if (unsubKeywords.some((kw) => combined.includes(kw))) {
      return {
        classification: 'UNSUBSCRIBE',
        confidence: 1.0,
        reason: 'Explicit unsubscribe keyword detected in reply.',
        model: 'deterministic_rules',
      };
    }

    // 2. Bounce checks
    const bounceKeywords = ['mailer-daemon', 'delivery status notification', 'undelivered mail', 'address not found', 'mailbox unavailable'];
    if (bounceKeywords.some((kw) => combined.includes(kw))) {
      return {
        classification: 'BOUNCE',
        confidence: 1.0,
        reason: 'Automated delivery bounce notification detected.',
        model: 'deterministic_rules',
      };
    }

    // 3. Out of Office checks
    const oooKeywords = ['out of the office', 'auto-reply', 'automatic reply', 'on annual leave', 'maternity leave', 'vacation response'];
    if (oooKeywords.some((kw) => combined.includes(kw))) {
      return {
        classification: 'OOO',
        confidence: 0.98,
        reason: 'Out-of-office automated responder detected.',
        model: 'deterministic_rules',
      };
    }

    // 4. Quick unambiguous negative checks
    const notInterestedKeywords = ['not interested', 'no thanks', 'not looking for this', 'please stop', 'no need'];
    if (notInterestedKeywords.some((kw) => combined.trim() === kw || combined.startsWith(kw))) {
      return {
        classification: 'NOT_INTERESTED',
        confidence: 0.95,
        reason: 'Direct negative rejection detected.',
        model: 'deterministic_rules',
      };
    }

    return null;
  }

  /**
   * Classifies an incoming email reply using AI with real database context.
   */
  static async classify(
    replyBody: string,
    replySubject: string,
    originalOutreachContext?: string
  ): Promise<ClassificationResult> {
    // 1. First run deterministic safeguards
    const deterministic = this.checkDeterministicRules(replySubject, replyBody);
    if (deterministic) return deterministic;

    // 2. Check LLM provider
    const llm = LLMProviderFactory.getProvider();
    if (!llm.isConfigured()) {
      // Basic heuristic fallback if LLM is not configured
      const lower = `${replySubject} ${replyBody}`.toLowerCase();
      if (lower.includes('call') || lower.includes('meet') || lower.includes('zoom') || lower.includes('schedule') || lower.includes('time')) {
        return {
          classification: 'MEETING_REQUEST',
          confidence: 0.75,
          reason: 'Heuristic keyword match: meeting or call requested.',
          model: 'heuristic_fallback (LLM_NOT_CONFIGURED)',
        };
      }
      if (lower.includes('yes') || lower.includes('share') || lower.includes('send') || lower.includes('interested')) {
        return {
          classification: 'INTERESTED',
          confidence: 0.7,
          reason: 'Heuristic keyword match: positive interest expressed.',
          model: 'heuristic_fallback (LLM_NOT_CONFIGURED)',
        };
      }

      return {
        classification: 'UNKNOWN',
        confidence: 0.5,
        reason: 'LLM not configured and no clear keyword rules matched.',
        model: 'heuristic_fallback (LLM_NOT_CONFIGURED)',
      };
    }

    // 3. Prompt LLM for classification and draft response
    const systemPrompt = `You are LeadPilot's Inbound Sales Reply Intelligence Engine.
Analyze the incoming email reply from a prospect and classify their intent accurately.

ALLOWED CLASSIFICATIONS:
- INTERESTED: Prospect wants to learn more, asks for a demo, or expresses genuine curiosity.
- MEETING_REQUEST: Prospect asks for a call, meeting, phone discussion, or calendar availability.
- QUESTION: Prospect asks specific questions about pricing, services, or how it works.
- NEEDS_INFO: Prospect requests more company details or credentials before deciding.
- NEGOTIATION: Prospect discusses budget, pricing terms, or commercial specifics.
- OOO: Out-of-office autoresponder or temporary absence.
- WRONG_PERSON: Prospect says they are not the right contact person or refers someone else.
- NOT_INTERESTED: Prospect declines politely or firmly.
- UNSUBSCRIBE: Prospect requests no further communication.
- BOUNCE: Delivery failure message.
- UNKNOWN: Ambiguous message requiring human review.

CRITICAL INSTRUCTIONS:
- Return strictly valid JSON.
- If classification is INTERESTED, QUESTION, NEEDS_INFO, or MEETING_REQUEST, generate a polite, concise, professional AI draft response for the sales rep to review.`;

    const userPrompt = `ORIGINAL OUTREACH SENT:
${originalOutreachContext ? originalOutreachContext.slice(0, 500) : 'Standard B2B digital audit outreach.'}

INCOMING REPLY RECEIVED:
Subject: ${replySubject}
Body:
${replyBody.slice(0, 1000)}

SCHEMA (JSON):
{
  "classification": "ONE OF THE ALLOWED CLASSIFICATIONS",
  "confidence": 0.0 to 1.0,
  "reason": "1-2 sentence explanation of why this classification was chosen",
  "detectedReturnDate": "YYYY-MM-DD if OOO mentions a date, otherwise null",
  "aiDraftResponse": "Helpful draft email reply for sales rep to approve, or null if not applicable"
}`;

    try {
      const response = await llm.generateText(userPrompt, systemPrompt, { jsonMode: true });
      const rawText = response.text.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const cleaned = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleaned);
      }

      const validClasses: ReplyClassificationType[] = [
        'INTERESTED',
        'NOT_INTERESTED',
        'QUESTION',
        'OOO',
        'NEEDS_INFO',
        'WRONG_PERSON',
        'UNSUBSCRIBE',
        'BOUNCE',
        'NEGOTIATION',
        'MEETING_REQUEST',
        'UNKNOWN',
      ];

      const classification = validClasses.includes(parsed.classification) ? parsed.classification : 'UNKNOWN';
      const confidence = typeof parsed.confidence === 'number' ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.8;

      return {
        classification,
        confidence,
        reason: parsed.reason || 'Classified by LLM.',
        detectedReturnDate: parsed.detectedReturnDate || undefined,
        aiDraftResponse: parsed.aiDraftResponse || undefined,
        model: response.model,
      };
    } catch (err: any) {
      return {
        classification: 'UNKNOWN',
        confidence: 0.0,
        reason: `LLM classification failed: ${err.message}`,
        model: llm.name,
      };
    }
  }
}
