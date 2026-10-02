import {
  LeadEvidenceItem,
  LeadScoringResult,
  WebsiteAuditResult,
  EmailVerificationResult,
  PhoneValidationResult,
  WebsiteCrawlSummary,
} from '../providers/types';

export interface ScoreInputs {
  businessName: string;
  hasWebsite: boolean;
  websiteUrl?: string;
  audit?: WebsiteAuditResult;
  crawl?: WebsiteCrawlSummary;
  emailVerification?: EmailVerificationResult;
  phoneValidation?: PhoneValidationResult;
  ratings?: { rating?: number; reviewCount?: number };
}

export function calculateExplainableLeadScore(inputs: ScoreInputs): LeadScoringResult {
  const evidence: LeadEvidenceItem[] = [];
  const reasons: string[] = [];
  const now = new Date().toISOString();

  // 1. FIT SCORE (Base 85 for discovering within target search criteria)
  let fitScore = 85;

  // 2. DIGITAL NEED SCORE (Calculated strictly from real technical and conversion gaps)
  let digitalNeedScore = 0;

  if (!inputs.hasWebsite || !inputs.websiteUrl) {
    digitalNeedScore += 60;
    const claim = 'No discoverable official website registered for this business';
    reasons.push(claim);
    evidence.push({
      evidenceType: 'WEBSITE_EXISTENCE',
      claim,
      confidence: 0.95,
      observedAt: now,
    });
  } else {
    // Website exists, evaluate real audit gaps
    if (inputs.audit) {
      if (!inputs.audit.isReachable) {
        digitalNeedScore += 50;
        const claim = 'Website domain is unreachable or returning server errors';
        reasons.push(claim);
        evidence.push({
          evidenceType: 'TECHNICAL_AUDIT',
          claim,
          sourceUrl: inputs.websiteUrl,
          confidence: 1.0,
          observedAt: now,
        });
      }

      if (inputs.audit.mobileIssues.length > 0) {
        digitalNeedScore += 25;
        const claim = inputs.audit.mobileIssues[0];
        reasons.push(claim);
        evidence.push({
          evidenceType: 'MOBILE_AUDIT',
          claim,
          sourceUrl: inputs.websiteUrl,
          confidence: 0.95,
          observedAt: now,
        });
      }

      if (inputs.audit.conversionIssues.length > 0) {
        digitalNeedScore += 25;
        for (const convIssue of inputs.audit.conversionIssues.slice(0, 2)) {
          reasons.push(convIssue);
          evidence.push({
            evidenceType: 'CONVERSION_AUDIT',
            claim: convIssue,
            sourceUrl: inputs.websiteUrl,
            confidence: 0.9,
            observedAt: now,
          });
        }
      }

      if (inputs.audit.performanceScore != null && inputs.audit.performanceScore < 50) {
        digitalNeedScore += 25;
        const claim = `Poor mobile performance (Google PageSpeed score: ${inputs.audit.performanceScore}/100)`;
        reasons.push(claim);
        evidence.push({
          evidenceType: 'PERFORMANCE_AUDIT',
          claim,
          sourceUrl: inputs.websiteUrl,
          snippet: `LCP: ${inputs.audit.coreWebVitals?.lcpMs || 'N/A'}ms, CLS: ${inputs.audit.coreWebVitals?.cls || 'N/A'}`,
          confidence: 1.0,
          observedAt: now,
        });
      }
    }
  }

  digitalNeedScore = Math.min(Math.max(digitalNeedScore, 10), 100);

  // 3. CONTACTABILITY SCORE
  let contactabilityScore = 0;

  if (inputs.phoneValidation && inputs.phoneValidation.isValid) {
    contactabilityScore += 45;
    const claim = `Verified business phone available (${inputs.phoneValidation.formattedNational || inputs.phoneValidation.rawPhone})`;
    reasons.push(claim);
    evidence.push({
      evidenceType: 'CONTACT_VERIFICATION',
      claim,
      confidence: inputs.phoneValidation.confidence,
      observedAt: now,
    });
  }

  if (inputs.emailVerification && inputs.emailVerification.status === 'DELIVERABLE') {
    contactabilityScore += 45;
    const claim = `Verified deliverable email address (${inputs.emailVerification.email})`;
    reasons.push(claim);
    evidence.push({
      evidenceType: 'CONTACT_VERIFICATION',
      claim,
      confidence: inputs.emailVerification.confidence,
      observedAt: now,
    });
  }

  if (inputs.crawl && inputs.crawl.whatsappLinks.length > 0) {
    contactabilityScore += 20;
    const claim = 'Active WhatsApp direct contact link detected on website';
    evidence.push({
      evidenceType: 'CONTACT_VERIFICATION',
      claim,
      confidence: 0.95,
      observedAt: now,
    });
  }

  contactabilityScore = Math.min(Math.max(contactabilityScore, 10), 100);

  // 4. EVIDENCE SCORE (Proportional to the verified evidence collected)
  const evidenceScore = Math.min(Math.max(evidence.length * 20, 20), 100);

  // 5. OPPORTUNITY SCORE (Weighted average)
  // High need + high contactability = highest pitch priority
  const opportunityScore = Math.round(
    fitScore * 0.15 + digitalNeedScore * 0.45 + contactabilityScore * 0.3 + evidenceScore * 0.1
  );

  return {
    opportunityScore: Math.min(Math.max(opportunityScore, 0), 100),
    fitScore,
    digitalNeedScore,
    contactabilityScore,
    evidenceScore,
    reasons: reasons.slice(0, 4),
    evidence,
  };
}

export {
  calculateLeadScore,
  type LeadScoreInput,
  type LeadScoreResult,
} from './leadScoreCalculator';

