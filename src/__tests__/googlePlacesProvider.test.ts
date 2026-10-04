import { describe, it, expect } from 'vitest';
import { GooglePlacesProvider } from '@/providers/google/GooglePlacesProvider';

describe('GooglePlacesProvider (Section 7, 8, 42)', () => {
  const provider = new GooglePlacesProvider();

  it('normalizes raw Google Places object into canonical candidate with rating and reviewCount', () => {
    const rawPlace = {
      id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      displayName: { text: 'The Great Indian Kitchen' },
      formattedAddress: 'Alpha 1, Greater Noida, Uttar Pradesh 201308, India',
      types: ['restaurant', 'food', 'point_of_interest'],
      primaryType: 'restaurant',
      location: { latitude: 28.4744, longitude: 77.504 },
      nationalPhoneNumber: '0120 123 4567',
      internationalPhoneNumber: '+91 120 123 4567',
      websiteUri: 'https://greatindiankitchen.com',
      googleMapsUri: 'https://maps.google.com/?cid=12345',
      rating: 4.6,
      userRatingCount: 1284,
      businessStatus: 'OPERATIONAL',
    };

    const candidate = provider.normalizePlace(rawPlace, {
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
    });

    expect(candidate.source).toBe('google_places');
    expect(candidate.placeId).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(candidate.name).toBe('The Great Indian Kitchen');
    expect(candidate.category).toBe('restaurant');
    expect(candidate.rating).toBe(4.6);
    expect(candidate.reviewCount).toBe(1284);
    expect(candidate.phone).toBe('0120 123 4567');
    expect(candidate.website).toBe('https://greatindiankitchen.com');
    expect(candidate.latitude).toBe(28.4744);
    expect(candidate.longitude).toBe(77.504);
  });

  it('handles missing rating and reviewCount as null (never invent values)', () => {
    const rawPlace = {
      id: 'ChIJ_sparse_data',
      displayName: { text: 'New Corner Dhaba' },
      formattedAddress: 'Knowledge Park, Greater Noida',
    };

    const candidate = provider.normalizePlace(rawPlace, {
      city: 'Greater Noida',
      state: 'Uttar Pradesh',
    });

    expect(candidate.rating).toBeNull();
    expect(candidate.reviewCount).toBeNull();
    expect(candidate.phone).toBeNull();
    expect(candidate.website).toBeNull();
  });

  it('returns structured NOT_CONFIGURED status when API key is missing', async () => {
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;
    const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    const unconfiguredProvider = new GooglePlacesProvider();
    const result = await unconfiguredProvider.searchBusinesses({
      query: 'restaurants',
      state: 'Uttar Pradesh',
    });

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.candidates).toHaveLength(0);

    // Restore env
    if (originalKey) process.env.GOOGLE_PLACES_API_KEY = originalKey;
    if (originalMapsKey) process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
  });
});
