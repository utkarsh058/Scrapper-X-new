export type CommercialMetricType = 'GMV' | 'SALES' | 'REVENUE' | 'ARR' | 'FUNDING' | 'VALUATION' | 'TRANSACTION_VOLUME';
export type MilestoneSourceType = 'PRIMARY' | 'SECONDARY' | 'INTERVIEW' | 'FUNDING_REPORT' | 'SEARCH_SNIPPET';
export type CommercialDatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ParsedMilestone {
  metricType: CommercialMetricType;
  amount: number | null;
  currency: string | null;
  formattedAmount: string;
  date: Date | null;
  datePrecision: CommercialDatePrecision | null;
  period: string | null;
  sourceUrl: string;
  sourceType: MilestoneSourceType;
  evidenceText: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class CommercialResearchProvider {
  /**
   * Search for commercial milestones in given text/HTML
   * In a real environment, this might call a custom search API, 
   * but here we parse provided context or fetch specific URLs.
   */
  public parseMilestonesFromText(text: string, sourceUrl: string, sourceType: MilestoneSourceType): ParsedMilestone[] {
    const milestones: ParsedMilestone[] = [];
    if (!text) return milestones;

    // Strict regex patterns to avoid false positives and maintain metric separation
    // 1. GMV
    const gmvRegex = /(?:GMV|Gross Merchandise Value)[^.!?]{0,40}?(?:of|reached|hit|stood at|was|at)\s*([$€£₹]|Rs|INR|USD)?\s*([\d,.]+)\s*(Million|Billion|Crore|Lakh|M|B|K)?/gi;
    let match;
    while ((match = gmvRegex.exec(text)) !== null) {
      const parsed = this.extractAmountAndCurrency(match);
      if (parsed) {
        milestones.push({
          metricType: 'GMV',
          amount: parsed.amount,
          currency: parsed.currency,
          formattedAmount: parsed.formatted,
          date: null, // to be populated by context
          datePrecision: null,
          period: null,
          sourceUrl,
          sourceType,
          evidenceText: match[0].trim(),
          confidence: 'HIGH'
        });
      }
    }

    // 2. Revenue (Strictly Revenue, not Sales or GMV)
    const revenueRegex = /(?:Revenue)[^.!?]{0,40}?(?:of|reached|hit|stood at|was|standing at|at)\s*([$€£₹]|Rs|INR|USD)?\s*([\d,.]+)\s*(Million|Billion|Crore|Lakh|M|B|K)?/gi;
    while ((match = revenueRegex.exec(text)) !== null) {
      const parsed = this.extractAmountAndCurrency(match);
      if (parsed) {
        milestones.push({
          metricType: 'REVENUE',
          amount: parsed.amount,
          currency: parsed.currency,
          formattedAmount: parsed.formatted,
          date: null,
          datePrecision: null,
          period: null,
          sourceUrl,
          sourceType,
          evidenceText: match[0].trim(),
          confidence: 'HIGH'
        });
      }
    }

    // 3. Sales
    const salesRegex = /(?:Sales)[^.!?]{0,40}?(?:of|reached|hit|stood at|was|at)\s*([$€£₹]|Rs|INR|USD)?\s*([\d,.]+)\s*(Million|Billion|Crore|Lakh|M|B|K)?/gi;
    while ((match = salesRegex.exec(text)) !== null) {
      const parsed = this.extractAmountAndCurrency(match);
      if (parsed) {
        milestones.push({
          metricType: 'SALES',
          amount: parsed.amount,
          currency: parsed.currency,
          formattedAmount: parsed.formatted,
          date: null,
          datePrecision: null,
          period: null,
          sourceUrl,
          sourceType,
          evidenceText: match[0].trim(),
          confidence: 'HIGH'
        });
      }
    }

    // 4. ARR
    const arrRegex = /(?:ARR|Annual Recurring Revenue)[^.!?]{0,40}?(?:of|reached|hit|stood at|was|at)\s*([$€£₹]|Rs|INR|USD)?\s*([\d,.]+)\s*(Million|Billion|Crore|Lakh|M|B|K)?/gi;
    while ((match = arrRegex.exec(text)) !== null) {
      const parsed = this.extractAmountAndCurrency(match);
      if (parsed) {
        milestones.push({
          metricType: 'ARR',
          amount: parsed.amount,
          currency: parsed.currency,
          formattedAmount: parsed.formatted,
          date: null,
          datePrecision: null,
          period: null,
          sourceUrl,
          sourceType,
          evidenceText: match[0].trim(),
          confidence: 'HIGH'
        });
      }
    }

    // Attempt to extract periods (e.g. FY23, Q1 2024) near the evidence
    for (const m of milestones) {
      const evidenceIndex = text.indexOf(m.evidenceText);
      const contextSnippet = text.substring(Math.max(0, evidenceIndex - 50), Math.min(text.length, evidenceIndex + m.evidenceText.length + 50));
      
      const periodMatch = contextSnippet.match(/\b(FY\d{2,4}|Q[1-4]\s*\d{4}|[A-Z][a-z]+\s*\d{4}|\d{4})\b/i);
      if (periodMatch) {
        m.period = periodMatch[1].toUpperCase();
        if (m.period.startsWith('FY')) {
          m.datePrecision = 'YEAR';
        } else if (m.period.startsWith('Q')) {
          m.datePrecision = 'QUARTER';
        } else if (/^\d{4}$/.test(m.period)) {
          m.datePrecision = 'YEAR';
        } else {
          m.datePrecision = 'MONTH'; // Month Year
        }
        // Very rough date assignment based on period
        m.date = this.parseDateFromPeriod(m.period);
      }
    }

    return milestones;
  }

  private extractAmountAndCurrency(match: RegExpExecArray): { amount: number | null, currency: string | null, formatted: string } | null {
    const symbol = match[1] || '';
    const numericStr = match[2];
    const multiplierStr = match[3] || '';

    if (!numericStr) return null;

    let currency = 'USD';
    if (symbol.includes('₹') || symbol.toLowerCase().includes('rs') || symbol.toLowerCase().includes('inr') || multiplierStr.toLowerCase().includes('crore') || multiplierStr.toLowerCase().includes('lakh')) {
      currency = 'INR';
    } else if (symbol.includes('€')) {
      currency = 'EUR';
    } else if (symbol.includes('£')) {
      currency = 'GBP';
    }

    let multiplier = 1;
    const mStr = multiplierStr.toLowerCase();
    if (mStr.includes('million') || mStr === 'm') multiplier = 1000000;
    else if (mStr.includes('billion') || mStr === 'b') multiplier = 1000000000;
    else if (mStr.includes('k')) multiplier = 1000;
    else if (mStr.includes('crore')) multiplier = 10000000;
    else if (mStr.includes('lakh')) multiplier = 100000;

    const amount = parseFloat(numericStr.replace(/,/g, '')) * multiplier;
    
    // Formatting for display
    let formatted = `${symbol ? symbol.trim() + ' ' : ''}${numericStr}${multiplierStr ? ' ' + multiplierStr : ''}`.trim();
    if (!symbol && currency === 'INR') formatted = `Rs ${formatted}`;
    if (!symbol && currency === 'USD') formatted = `$${formatted}`;

    return { amount, currency, formatted };
  }

  private parseDateFromPeriod(period: string): Date | null {
    const fyMatch = period.match(/FY(\d{2,4})/i);
    if (fyMatch) {
      let year = parseInt(fyMatch[1]);
      if (year < 100) year += 2000;
      return new Date(Date.UTC(year, 0, 1));
    }
    const qMatch = period.match(/Q([1-4])\s*(\d{4})/i);
    if (qMatch) {
      const q = parseInt(qMatch[1]);
      const year = parseInt(qMatch[2]);
      const month = (q - 1) * 3;
      return new Date(Date.UTC(year, month, 1));
    }
    const yearMatch = period.match(/^(\d{4})$/);
    if (yearMatch) {
      return new Date(Date.UTC(parseInt(yearMatch[1]), 0, 1));
    }
    return null;
  }
}

export const commercialResearchProvider = new CommercialResearchProvider();
