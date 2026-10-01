import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { PhoneValidationProvider, PhoneValidationResult } from './types';

export class LibPhoneNumberValidationProvider implements PhoneValidationProvider {
  readonly name = 'libphonenumber';

  async validatePhone(phone: string, defaultCountry: string = 'IN'): Promise<PhoneValidationResult> {
    const raw = (phone || '').trim();
    if (!raw) {
      return {
        rawPhone: phone,
        isValid: false,
        confidence: 0,
        provider: this.name,
      };
    }

    try {
      const country = (defaultCountry.toUpperCase() || 'IN') as CountryCode;
      const valid = isValidPhoneNumber(raw, country);

      if (!valid) {
        return {
          rawPhone: raw,
          isValid: false,
          confidence: 0.9,
          provider: this.name,
        };
      }

      const parsed = parsePhoneNumber(raw, country);

      let lineType: 'MOBILE' | 'FIXED_LINE' | 'VOIP' | 'UNKNOWN' = 'UNKNOWN';
      const typeStr = parsed.getType();
      if (typeStr === 'MOBILE') lineType = 'MOBILE';
      else if (typeStr === 'FIXED_LINE') lineType = 'FIXED_LINE';
      else if (typeStr === 'VOIP') lineType = 'VOIP';

      return {
        rawPhone: raw,
        isValid: true,
        formattedE164: parsed.format('E.164'),
        formattedNational: parsed.formatNational(),
        formattedInternational: parsed.formatInternational(),
        countryCode: parsed.country,
        lineType,
        confidence: 0.95,
        provider: this.name,
      };
    } catch {
      return {
        rawPhone: raw,
        isValid: false,
        confidence: 0.7,
        provider: this.name,
      };
    }
  }
}

export const phoneValidator = new LibPhoneNumberValidationProvider();
