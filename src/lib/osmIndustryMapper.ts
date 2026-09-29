/**
 * Maps LeadPilot industry categories to OpenStreetMap (OSM) key/value tags.
 * Designed to be modular so additional industry mappings can easily be added.
 */

export interface OsmTagCondition {
  key: string;
  value?: string; // If undefined, matches any existence of the key (e.g. shop=*)
}

export interface IndustryMapping {
  industry: string;
  osmTags: OsmTagCondition[];
  description: string;
}

export const OSM_INDUSTRY_MAPPINGS: Record<string, OsmTagCondition[]> = {
  // 1. Food & Hospitality
  'Restaurants': [
    { key: 'amenity', value: 'restaurant' },
    { key: 'amenity', value: 'fast_food' }
  ],
  'Restaurant': [
    { key: 'amenity', value: 'restaurant' }
  ],
  'Cafes': [
    { key: 'amenity', value: 'cafe' }
  ],
  'Cafe': [
    { key: 'amenity', value: 'cafe' }
  ],
  'Hotels': [
    { key: 'tourism', value: 'hotel' },
    { key: 'tourism', value: 'guest_house' }
  ],
  'Hotel': [
    { key: 'tourism', value: 'hotel' }
  ],

  // 2. Health & Wellness
  'Hospitals': [
    { key: 'amenity', value: 'hospital' }
  ],
  'Hospital': [
    { key: 'amenity', value: 'hospital' }
  ],
  'Clinics': [
    { key: 'amenity', value: 'clinic' },
    { key: 'amenity', value: 'doctors' },
    { key: 'healthcare', value: 'clinic' }
  ],
  'Clinic': [
    { key: 'amenity', value: 'clinic' },
    { key: 'amenity', value: 'doctors' }
  ],
  'Pharmacy': [
    { key: 'amenity', value: 'pharmacy' }
  ],
  'Gyms': [
    { key: 'leisure', value: 'fitness_centre' },
    { key: 'leisure', value: 'sports_centre' }
  ],
  'Gym': [
    { key: 'leisure', value: 'fitness_centre' }
  ],
  'Salons': [
    { key: 'shop', value: 'hairdresser' },
    { key: 'shop', value: 'beauty' }
  ],
  'Salon': [
    { key: 'shop', value: 'hairdresser' },
    { key: 'shop', value: 'beauty' }
  ],

  // 3. Education
  'Education': [
    { key: 'amenity', value: 'school' },
    { key: 'amenity', value: 'college' },
    { key: 'amenity', value: 'university' }
  ],
  'School': [
    { key: 'amenity', value: 'school' }
  ],
  'College': [
    { key: 'amenity', value: 'college' },
    { key: 'amenity', value: 'university' }
  ],

  // 4. Finance & Utilities
  'Bank': [
    { key: 'amenity', value: 'bank' }
  ],
  'Petrol Pump': [
    { key: 'amenity', value: 'fuel' }
  ],

  // 5. Commerce & Retail
  'Retail': [
    { key: 'shop', value: 'supermarket' },
    { key: 'shop', value: 'convenience' },
    { key: 'shop', value: 'department_store' },
    { key: 'shop', value: 'clothes' }
  ],
  'Supermarket': [
    { key: 'shop', value: 'supermarket' }
  ],
  'Travel Agency': [
    { key: 'shop', value: 'travel_agency' },
    { key: 'office', value: 'travel_agent' }
  ],
  'Travel': [
    { key: 'shop', value: 'travel_agency' },
    { key: 'office', value: 'travel_agent' },
    { key: 'tourism', value: 'information' }
  ],
  'Real Estate': [
    { key: 'office', value: 'estate_agent' },
    { key: 'office', value: 'real_estate' }
  ],
  'Automotive': [
    { key: 'shop', value: 'car' },
    { key: 'shop', value: 'car_repair' },
    { key: 'shop', value: 'motorcycle' }
  ],
  'Construction': [
    { key: 'craft', value: 'builder' },
    { key: 'office', value: 'architect' },
    { key: 'office', value: 'engineer' }
  ],
  'Other': [
    { key: 'office', value: 'company' },
    { key: 'shop' },
    { key: 'amenity', value: 'commercial' }
  ]
};

/**
 * Returns OSM tag conditions for a given industry name (case-insensitive with fallback).
 */
export function getOsmTagsForIndustry(industry: string): OsmTagCondition[] {
  const normalized = industry.trim();
  
  // Exact match
  if (OSM_INDUSTRY_MAPPINGS[normalized]) {
    return OSM_INDUSTRY_MAPPINGS[normalized];
  }

  // Case-insensitive lookup
  const lower = normalized.toLowerCase();
  for (const [key, tags] of Object.entries(OSM_INDUSTRY_MAPPINGS)) {
    if (key.toLowerCase() === lower || key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return tags;
    }
  }

  // Fallback for custom industry terms (search as amenity, shop, or office)
  return [
    { key: 'amenity', value: lower.replace(/\s+/g, '_') },
    { key: 'shop', value: lower.replace(/\s+/g, '_') },
    { key: 'office', value: lower.replace(/\s+/g, '_') }
  ];
}

/**
 * Builds Overpass QL filter strings for nodes, ways, and relations within a bounding box.
 * Format for bbox in Overpass: (south, west, north, east)
 */
export function buildOverpassFilters(
  tags: OsmTagCondition[],
  bbox: { south: number; west: number; north: number; east: number }
): string {
  const { south, west, north, east } = bbox;
  const bboxStr = `(${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)})`;

  const statements: string[] = [];
  for (const tag of tags) {
    const tagFilter = tag.value 
      ? `["${tag.key}"="${tag.value}"]` 
      : `["${tag.key}"]`;
    
    statements.push(`node${tagFilter}${bboxStr};`);
    statements.push(`way${tagFilter}${bboxStr};`);
    statements.push(`relation${tagFilter}${bboxStr};`);
  }

  return statements.join('\n  ');
}
