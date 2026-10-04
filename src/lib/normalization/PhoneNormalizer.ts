/**
 * Phone Normalizer
 * Country-aware phone normalization using libphonenumber-js.
 * Strictly adheres to Zero Fake Data Policy.
 */

import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface NormalizedPhoneResult {
  rawPhone: string;
  normalizedPhone: string | null;
  e164: string | null;
  countryCode: 'IN' | 'US' | 'CA' | null;
  isValid: boolean;
  phoneSource: string;
}

export class PhoneNormalizer {
  /**
   * Normalizes a phone number using country context.
   */
  public normalize(
    rawPhone?: string | null,
    countryCode: 'IN' | 'US' | 'CA' | string = 'IN',
    phoneSource: string = 'google_places'
  ): NormalizedPhoneResult {
    if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
      return {
        rawPhone: rawPhone || '',
        normalizedPhone: null,
        e164: null,
        countryCode: null,
        isValid: false,
        phoneSource,
      };
    }

    const trimmed = rawPhone.trim();
    const defaultCountry = (countryCode?.toUpperCase() || 'IN') as CountryCode;

    try {
      const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);

      if (parsed && parsed.isValid()) {
        const parsedCountry = parsed.country as 'IN' | 'US' | 'CA';
        return {
          rawPhone: trimmed,
          normalizedPhone: parsed.formatNational(),
          e164: parsed.format('E.164'),
          countryCode: parsedCountry || (defaultCountry as any),
          isValid: true,
          phoneSource,
        };
      }

      // If parsing failed with defaultCountry, try without default country if it starts with '+'
      if (trimmed.startsWith('+')) {
        const parsedWithPlus = parsePhoneNumberFromString(trimmed);
        if (parsedWithPlus && parsedWithPlus.isValid()) {
          return {
            rawPhone: trimmed,
            normalizedPhone: parsedWithPlus.formatNational(),
            e164: parsedWithPlus.format('E.164'),
            countryCode: (parsedWithPlus.country as any) || (defaultCountry as any),
            isValid: true,
            phoneSource,
          };
        }
      }

      // Invalid or non-conforming phone number: preserve raw, but normalized is NULL
      return {
        rawPhone: trimmed,
        normalizedPhone: null,
        e164: null,
        countryCode: null,
        isValid: false,
        phoneSource,
      };
    } catch {
      return {
        rawPhone: trimmed,
        normalizedPhone: null,
        e164: null,
        countryCode: null,
        isValid: false,
        phoneSource,
      };
    }
  }
}

export const phoneNormalizer = new PhoneNormalizer();
