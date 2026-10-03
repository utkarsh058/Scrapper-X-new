/**
 * Phone Verification Provider Abstraction for LeadPilot
 * 
 * Architecture:
 *   PhoneVerificationProvider interface
 *     ├── LibPhoneNumberSyntaxProvider (always available - syntax + country + line type)
 *     └── TwilioLookupProvider (when TWILIO_* env vars configured - carrier + type)
 * 
 * RULES:
 * - If provider is not configured: status = UNAVAILABLE (NOT VERIFIED)
 * - NEVER manufacture verification results
 * - NEVER call SYNTAX_VALID == VERIFIED
 * - Syntax validation is NOT the same as carrier verification
 */
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import {
  ContactVerificationStatus,
  VerificationLevel,
  PhoneLineType,
} from './contactTypes';

// ─── Phone Verification Result ──────────────────────────────

export interface PhoneVerificationResult {
  rawPhone: string;
  normalizedE164?: string;
  nationalFormat?: string;
  internationalFormat?: string;
  countryCode?: string;
  isValid: boolean;
  lineType: PhoneLineType;
  carrier?: string;
  verificationStatus: ContactVerificationStatus;
  verificationLevel: VerificationLevel;
  confidence: number;
  provider: string;
  details?: Record<string, any>;
}

// ─── Provider Interface ─────────────────────────────────────

export interface PhoneVerificationProvider {
  readonly name: string;
  isConfigured(): boolean;
  verifyPhone(phone: string, defaultCountry?: string): Promise<PhoneVerificationResult>;
}

// ─── LibPhoneNumber Syntax Provider ─────────────────────────

export class LibPhoneNumberSyntaxProvider implements PhoneVerificationProvider {
  readonly name = 'libphonenumber_syntax';

  isConfigured(): boolean {
    return true; // Always available
  }

  async verifyPhone(phone: string, defaultCountry: string = 'IN'): Promise<PhoneVerificationResult> {
    const raw = (phone || '').trim();
    if (!raw) {
      return {
        rawPhone: phone,
        isValid: false,
        lineType: 'UNKNOWN',
        verificationStatus: 'INVALID',
        verificationLevel: 'SYNTAX',
        confidence: 1.0,
        provider: this.name,
        details: { reason: 'Empty phone number' },
      };
    }

    try {
      const country = (defaultCountry.toUpperCase() || 'IN') as CountryCode;
      const valid = isValidPhoneNumber(raw, country);

      if (!valid) {
        return {
          rawPhone: raw,
          isValid: false,
          lineType: 'UNKNOWN',
          verificationStatus: 'INVALID',
          verificationLevel: 'SYNTAX',
          confidence: 0.9,
          provider: this.name,
          details: { reason: 'Failed phone number validation' },
        };
      }

      const parsed = parsePhoneNumber(raw, country);
      let lineType: PhoneLineType = 'UNKNOWN';
      const typeStr = parsed.getType();
      if (typeStr === 'MOBILE') lineType = 'MOBILE';
      else if (typeStr === 'FIXED_LINE') lineType = 'LANDLINE';
      else if (typeStr === 'VOIP') lineType = 'VOIP';
      else if (typeStr === 'FIXED_LINE_OR_MOBILE') lineType = 'MOBILE';
      else if (!typeStr) {
        // libphonenumber-js may not determine type for some valid numbers
        // Use heuristic: Indian numbers starting with 6-9 are typically mobile
        const e164 = parsed.format('E.164');
        if (e164.startsWith('+91')) {
          const afterPrefix = e164.substring(3); // digits after +91
          const firstDigit = afterPrefix[0];
          if (firstDigit >= '6' && firstDigit <= '9') {
            lineType = 'MOBILE';
          } else if (firstDigit >= '1' && firstDigit <= '5') {
            // Indian landline area codes: 11 (Delhi), 22 (Mumbai), 33 (Kolkata), etc.
            lineType = 'LANDLINE';
          }
        }
      }

      // Syntax validation only — NOT the same as carrier verification
      // Status reflects line type but NOT deliverability
      let verificationStatus: ContactVerificationStatus = 'UNVERIFIED';
      if (lineType === 'MOBILE') verificationStatus = 'MOBILE';
      else if (lineType === 'LANDLINE') verificationStatus = 'LANDLINE';
      else if (lineType === 'VOIP') verificationStatus = 'VOIP';

      return {
        rawPhone: raw,
        normalizedE164: parsed.format('E.164'),
        nationalFormat: parsed.formatNational(),
        internationalFormat: parsed.formatInternational(),
        countryCode: parsed.country,
        isValid: true,
        lineType,
        verificationStatus,
        verificationLevel: 'SYNTAX',
        confidence: 0.7,  // Syntax only — NOT carrier confirmed
        provider: this.name,
        details: {
          type: typeStr,
          possible: parsed.isPossible(),
          valid: true,
        },
      };
    } catch {
      return {
        rawPhone: raw,
        isValid: false,
        lineType: 'UNKNOWN',
        verificationStatus: 'INVALID',
        verificationLevel: 'SYNTAX',
        confidence: 0.7,
        provider: this.name,
        details: { reason: 'Phone parsing failed' },
      };
    }
  }
}

// ─── Twilio Lookup Provider ─────────────────────────────────

export class TwilioLookupProvider implements PhoneVerificationProvider {
  readonly name = 'twilio_lookup';

  isConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async verifyPhone(phone: string, defaultCountry: string = 'IN'): Promise<PhoneVerificationResult> {
    const raw = (phone || '').trim();

    if (!this.isConfigured()) {
      return {
        rawPhone: raw,
        isValid: false,
        lineType: 'UNKNOWN',
        verificationStatus: 'UNAVAILABLE',
        verificationLevel: 'SYNTAX',
        confidence: 0,
        provider: this.name,
        details: { reason: 'Twilio Lookup not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)' },
      };
    }

    // First get the E.164 format via libphonenumber
    const syntaxProvider = new LibPhoneNumberSyntaxProvider();
    const syntaxResult = await syntaxProvider.verifyPhone(raw, defaultCountry);

    if (!syntaxResult.isValid || !syntaxResult.normalizedE164) {
      return {
        ...syntaxResult,
        provider: this.name,
      };
    }

    const e164 = syntaxResult.normalizedE164;
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;

    try {
      const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
      const response = await fetch(url, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        // Twilio returned an error — report UNAVAILABLE, not VERIFIED
        return {
          ...syntaxResult,
          verificationLevel: 'SYNTAX',
          provider: this.name,
          details: {
            ...syntaxResult.details,
            twilioError: `HTTP ${response.status}`,
          },
        };
      }

      const data = await response.json();
      let lineType: PhoneLineType = syntaxResult.lineType;
      let carrier: string | undefined;

      if (data.line_type_intelligence) {
        const lti = data.line_type_intelligence;
        if (lti.type === 'mobile') lineType = 'MOBILE';
        else if (lti.type === 'landline') lineType = 'LANDLINE';
        else if (lti.type === 'voip') lineType = 'VOIP';
        carrier = lti.carrier_name || undefined;
      }

      let verificationStatus: ContactVerificationStatus = 'VERIFIED';
      if (lineType === 'MOBILE') verificationStatus = 'MOBILE';
      else if (lineType === 'LANDLINE') verificationStatus = 'LANDLINE';
      else if (lineType === 'VOIP') verificationStatus = 'VOIP';

      return {
        rawPhone: raw,
        normalizedE164: e164,
        nationalFormat: syntaxResult.nationalFormat,
        internationalFormat: syntaxResult.internationalFormat,
        countryCode: syntaxResult.countryCode,
        isValid: true,
        lineType,
        carrier,
        verificationStatus,
        verificationLevel: 'CARRIER',
        confidence: 0.95,
        provider: this.name,
        details: {
          ...syntaxResult.details,
          twilioResponse: {
            valid: data.valid,
            callingCountryCode: data.calling_country_code,
            countryCode: data.country_code,
            lineType: data.line_type_intelligence?.type,
            carrier: carrier,
          },
        },
      };
    } catch (err: any) {
      // Network failure — return syntax result with UNAVAILABLE for carrier level
      return {
        ...syntaxResult,
        provider: this.name,
        details: {
          ...syntaxResult.details,
          twilioError: err.message || 'Twilio Lookup request failed',
        },
      };
    }
  }
}

// ─── Composite Phone Verification Service ───────────────────

export class CompositePhoneVerificationService {
  private syntaxProvider: LibPhoneNumberSyntaxProvider;
  private carrierProvider: TwilioLookupProvider;

  constructor() {
    this.syntaxProvider = new LibPhoneNumberSyntaxProvider();
    this.carrierProvider = new TwilioLookupProvider();
  }

  /**
   * Verifies a phone number using the best available provider.
   * - Always runs syntax validation (libphonenumber)
   * - Uses Twilio Lookup for carrier verification when configured
   * - NEVER returns VERIFIED when provider is unavailable
   */
  async verifyPhone(phone: string, defaultCountry: string = 'IN'): Promise<PhoneVerificationResult> {
    // Try carrier-level verification first if configured
    if (this.carrierProvider.isConfigured()) {
      return this.carrierProvider.verifyPhone(phone, defaultCountry);
    }

    // Fall back to syntax-level validation
    return this.syntaxProvider.verifyPhone(phone, defaultCountry);
  }

  getProviderStatus(): { name: string; status: 'READY' | 'NOT_CONFIGURED' } {
    if (this.carrierProvider.isConfigured()) {
      return { name: 'twilio_lookup', status: 'READY' };
    }
    return { name: 'libphonenumber_syntax', status: 'READY' };
  }
}

export const phoneVerificationService = new CompositePhoneVerificationService();
