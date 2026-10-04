/**
 * Geographic Resolver for India
 * Resolves Indian States, Union Territories, and Cities into precise geographic areas & bounding boxes.
 * Provides strict coordinate verification so businesses from other cities/states are rejected.
 */

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
  centerLat: number;
  centerLon: number;
}

// In-memory cache for resolved city coordinates
const geoCache = new Map<string, BoundingBox>();

// Known bounding boxes and centers for Indian states/UTs
export const STATE_BOUNDS: Record<string, BoundingBox> = {
  'Delhi': { south: 28.40, west: 76.84, north: 28.88, east: 77.35, centerLat: 28.6139, centerLon: 77.2090 },
  'Chandigarh': { south: 30.68, west: 76.72, north: 30.79, east: 76.84, centerLat: 30.7333, centerLon: 76.7794 },
  'Goa': { south: 14.90, west: 73.68, north: 15.80, east: 74.34, centerLat: 15.2993, centerLon: 74.1240 },
  'Puducherry': { south: 11.85, west: 79.75, north: 12.05, east: 79.88, centerLat: 11.9416, centerLon: 79.8083 },
  'Uttar Pradesh': { south: 23.85, west: 77.05, north: 30.40, east: 84.65, centerLat: 26.8467, centerLon: 80.9462 },
  'Maharashtra': { south: 15.60, west: 72.60, north: 22.05, east: 80.90, centerLat: 19.7515, centerLon: 75.7139 },
  'Karnataka': { south: 11.59, west: 74.05, north: 18.45, east: 78.58, centerLat: 15.3173, centerLon: 75.7139 },
  'Tamil Nadu': { south: 8.08, west: 76.24, north: 13.56, east: 80.34, centerLat: 11.1271, centerLon: 78.6569 },
  'Gujarat': { south: 20.10, west: 68.15, north: 24.70, east: 74.47, centerLat: 22.2587, centerLon: 71.1924 },
  'Rajasthan': { south: 23.05, west: 69.50, north: 30.20, east: 78.28, centerLat: 27.0238, centerLon: 74.2179 },
  'West Bengal': { south: 21.50, west: 85.80, north: 27.20, east: 89.90, centerLat: 22.9868, centerLon: 87.8550 },
  'Telangana': { south: 15.80, west: 77.20, north: 19.90, east: 81.80, centerLat: 18.1124, centerLon: 79.0193 },
  'Kerala': { south: 8.30, west: 74.85, north: 12.80, east: 77.40, centerLat: 10.8505, centerLon: 76.2711 },
  'Madhya Pradesh': { south: 21.05, west: 74.02, north: 26.87, east: 82.80, centerLat: 22.9734, centerLon: 78.6569 },
  'Haryana': { south: 27.65, west: 74.45, north: 30.90, east: 77.60, centerLat: 29.0588, centerLon: 76.0856 },
  'Punjab': { south: 29.50, west: 73.85, north: 32.50, east: 76.90, centerLat: 31.1471, centerLon: 75.3412 },
  'Bihar': { south: 24.28, west: 83.32, north: 27.52, east: 88.30, centerLat: 25.0961, centerLon: 85.3131 },
  'Odisha': { south: 17.80, west: 81.40, north: 22.58, east: 87.50, centerLat: 20.9517, centerLon: 85.0985 },
  'Andhra Pradesh': { south: 12.60, west: 76.75, north: 19.15, east: 84.75, centerLat: 15.9129, centerLon: 79.7400 },
  'Assam': { south: 24.15, west: 89.70, north: 28.00, east: 96.00, centerLat: 26.2006, centerLon: 92.9376 },
  'Jharkhand': { south: 21.95, west: 83.30, north: 25.35, east: 87.95, centerLat: 23.6102, centerLon: 85.2799 },
  'Chhattisgarh': { south: 17.75, west: 80.25, north: 24.10, east: 84.40, centerLat: 21.2787, centerLon: 81.8661 },
  'Uttarakhand': { south: 28.70, west: 77.55, north: 31.45, east: 81.05, centerLat: 30.0668, centerLon: 79.0193 },
  'Himachal Pradesh': { south: 30.35, west: 75.60, north: 33.25, east: 79.05, centerLat: 31.1048, centerLon: 77.1734 },
  'Jammu and Kashmir': { south: 32.25, west: 73.40, north: 35.15, east: 76.80, centerLat: 33.7782, centerLon: 76.5762 },
  'Ladakh': { south: 32.20, west: 75.50, north: 36.00, east: 79.50, centerLat: 34.1526, centerLon: 77.5771 },
  // Northeast & Island UTs completing all 36 States & UTs
  'Arunachal Pradesh': { south: 26.65, west: 91.50, north: 29.50, east: 97.40, centerLat: 28.2180, centerLon: 94.7278 },
  'Manipur': { south: 23.83, west: 93.03, north: 25.68, east: 94.78, centerLat: 24.6637, centerLon: 93.9063 },
  'Meghalaya': { south: 25.02, west: 89.82, north: 26.12, east: 92.80, centerLat: 25.4670, centerLon: 91.3662 },
  'Mizoram': { south: 21.95, west: 92.25, north: 24.52, east: 93.43, centerLat: 23.1645, centerLon: 92.9376 },
  'Nagaland': { south: 25.10, west: 93.30, north: 27.05, east: 95.25, centerLat: 26.1584, centerLon: 94.5624 },
  'Sikkim': { south: 27.05, west: 88.00, north: 28.15, east: 88.95, centerLat: 27.5330, centerLon: 88.5122 },
  'Tripura': { south: 22.93, west: 91.15, north: 24.53, east: 92.35, centerLat: 23.9408, centerLon: 91.9882 },
  'Andaman and Nicobar Islands': { south: 6.75, west: 92.20, north: 13.70, east: 94.30, centerLat: 11.7401, centerLon: 92.6586 },
  'Dadra and Nagar Haveli and Daman and Diu': { south: 20.00, west: 70.80, north: 20.80, east: 73.20, centerLat: 20.4283, centerLon: 72.8397 },
  'Lakshadweep': { south: 8.25, west: 71.70, north: 12.40, east: 74.00, centerLat: 10.5667, centerLon: 72.6417 },
  // Canadian Provinces & Territories
  'Ontario': { south: 41.68, west: -95.16, north: 56.86, east: -74.34, centerLat: 51.2538, centerLon: -85.3232 },
  'Quebec': { south: 44.99, west: -79.76, north: 62.58, east: -57.10, centerLat: 52.9399, centerLon: -73.5491 },
  'British Columbia': { south: 48.30, west: -139.06, north: 60.00, east: -114.03, centerLat: 53.7267, centerLon: -127.6476 },
  'Alberta': { south: 48.99, west: -120.00, north: 60.00, east: -110.00, centerLat: 53.9333, centerLon: -116.5765 },
  'Manitoba': { south: 49.00, west: -102.03, north: 60.00, east: -88.98, centerLat: 53.7609, centerLon: -98.8139 },
  'Saskatchewan': { south: 49.00, west: -110.00, north: 60.00, east: -101.36, centerLat: 52.9399, centerLon: -106.4509 },
  'Nova Scotia': { south: 43.38, west: -66.42, north: 47.03, east: -59.74, centerLat: 44.6820, centerLon: -63.7443 },
  'New Brunswick': { south: 44.60, west: -69.06, north: 48.07, east: -63.77, centerLat: 46.5653, centerLon: -66.4619 },
  'Newfoundland and Labrador': { south: 46.61, west: -67.80, north: 60.37, east: -52.62, centerLat: 53.1355, centerLon: -57.6604 },
  'Prince Edward Island': { south: 45.95, west: -64.42, north: 47.05, east: -61.97, centerLat: 46.5107, centerLon: -63.4168 },
  'Northwest Territories': { south: 60.00, west: -136.44, north: 78.77, east: -101.98, centerLat: 64.8255, centerLon: -124.8457 },
  'Nunavut': { south: 51.19, west: -120.69, north: 83.11, east: -61.02, centerLat: 70.2998, centerLon: -83.1076 },
  'Yukon': { south: 60.00, west: -141.00, north: 69.65, east: -123.81, centerLat: 64.2823, centerLon: -135.0000 }
};

// Generic pan-Canada bounding box
export const CANADA_PAN_BOUNDS: BoundingBox = {
  south: 41.67,
  west: -141.00,
  north: 83.11,
  east: -52.62,
  centerLat: 56.1304,
  centerLon: -106.3468,
};

// Generic pan-India bounding box covering all territories
export const INDIA_PAN_BOUNDS: BoundingBox = {
  south: 6.75,
  west: 68.15,
  north: 37.10,
  east: 97.40,
  centerLat: 20.5937,
  centerLon: 78.9629,
};

/**
 * Splits a large bounding box into overlapping geographic grid cells.
 * Prevents large-area queries (e.g. Maharashtra, Rajasthan, UP) from collapsing to center-only POIs.
 */
export function partitionBoundingBox(
  bbox: BoundingBox,
  maxSpanDeg: number = 1.2,
  overlapRatio: number = 0.15
): BoundingBox[] {
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;

  if (latSpan <= maxSpanDeg && lonSpan <= maxSpanDeg) {
    return [bbox];
  }

  const numLatSteps = Math.ceil(latSpan / maxSpanDeg);
  const numLonSteps = Math.ceil(lonSpan / maxSpanDeg);

  const stepLat = latSpan / numLatSteps;
  const stepLon = lonSpan / numLonSteps;
  const overlapLat = stepLat * overlapRatio;
  const overlapLon = stepLon * overlapRatio;

  const partitions: BoundingBox[] = [];

  for (let i = 0; i < numLatSteps; i++) {
    for (let j = 0; j < numLonSteps; j++) {
      const south = Math.max(bbox.south, bbox.south + i * stepLat - overlapLat);
      const north = Math.min(bbox.north, bbox.south + (i + 1) * stepLat + overlapLat);
      const west = Math.max(bbox.west, bbox.west + j * stepLon - overlapLon);
      const east = Math.min(bbox.east, bbox.west + (j + 1) * stepLon + overlapLon);

      partitions.push({
        south,
        west,
        north,
        east,
        centerLat: (south + north) / 2,
        centerLon: (west + east) / 2,
      });
    }
  }

  return partitions;
}

// Known tight bounding boxes for major Indian cities
// Specifically calibrated to prevent bleeding into adjacent cities
export const MAJOR_CITIES_BOUNDS: Record<string, BoundingBox> = {
  // Uttar Pradesh NCR
  'Noida': { south: 28.44, west: 77.28, north: 28.66, east: 77.46, centerLat: 28.5355, centerLon: 77.3910 },
  'Greater Noida': { south: 28.40, west: 77.44, north: 28.58, east: 77.62, centerLat: 28.4744, centerLon: 77.5040 },
  'Ghaziabad': { south: 28.58, west: 77.35, north: 28.76, east: 77.54, centerLat: 28.6692, centerLon: 77.4538 },
  'Lucknow': { south: 26.72, west: 80.82, north: 26.98, east: 81.08, centerLat: 26.8467, centerLon: 80.9462 },
  'Kanpur': { south: 26.38, west: 80.22, north: 26.56, east: 80.44, centerLat: 26.4499, centerLon: 80.3319 },
  'Agra': { south: 27.10, west: 77.92, north: 27.26, east: 78.09, centerLat: 27.1767, centerLon: 78.0081 },
  'Varanasi': { south: 25.24, west: 82.92, north: 25.39, east: 83.07, centerLat: 25.3176, centerLon: 82.9739 },
  'Prayagraj': { south: 25.38, west: 81.78, north: 25.52, east: 81.94, centerLat: 25.4358, centerLon: 81.8463 },
  'Meerut': { south: 28.92, west: 77.63, north: 29.06, east: 77.78, centerLat: 28.9845, centerLon: 77.7064 },
  'Bareilly': { south: 28.30, west: 79.36, north: 28.44, east: 79.50, centerLat: 28.3670, centerLon: 79.4304 },
  'Aligarh': { south: 27.84, west: 78.02, north: 27.96, east: 78.15, centerLat: 27.8974, centerLon: 78.0880 },

  // Delhi NCR
  'Delhi': { south: 28.40, west: 76.84, north: 28.88, east: 77.35, centerLat: 28.6139, centerLon: 77.2090 },
  'New Delhi': { south: 28.50, west: 77.12, north: 28.68, east: 77.28, centerLat: 28.6139, centerLon: 77.2090 },
  'Central Delhi': { south: 28.60, west: 77.17, north: 28.69, east: 77.26, centerLat: 28.6448, centerLon: 77.2167 },
  'South Delhi': { south: 28.46, west: 77.13, north: 28.59, east: 77.27, centerLat: 28.5355, centerLon: 77.2000 },
  'North Delhi': { south: 28.67, west: 77.09, north: 28.82, east: 77.24, centerLat: 28.7400, centerLon: 77.1600 },
  'East Delhi': { south: 28.59, west: 77.26, north: 28.69, east: 77.34, centerLat: 28.6400, centerLon: 77.3000 },
  'West Delhi': { south: 28.59, west: 77.04, north: 28.70, east: 77.17, centerLat: 28.6500, centerLon: 77.1000 },

  // Haryana
  'Gurugram': { south: 28.38, west: 76.95, north: 28.52, east: 77.12, centerLat: 28.4595, centerLon: 77.0266 },
  'Gurgaon': { south: 28.38, west: 76.95, north: 28.52, east: 77.12, centerLat: 28.4595, centerLon: 77.0266 },
  'Faridabad': { south: 28.32, west: 77.25, north: 28.46, east: 77.38, centerLat: 28.4089, centerLon: 77.3178 },
  'Panipat': { south: 29.35, west: 76.92, north: 29.43, east: 77.02, centerLat: 29.3909, centerLon: 76.9635 },
  'Ambala': { south: 30.34, west: 76.74, north: 30.42, east: 76.84, centerLat: 30.3782, centerLon: 76.7767 },

  // Maharashtra
  'Mumbai': { south: 18.89, west: 72.77, north: 19.28, east: 72.99, centerLat: 19.0760, centerLon: 72.8777 },
  'Pune': { south: 18.42, west: 73.75, north: 18.64, east: 73.98, centerLat: 18.5204, centerLon: 73.8567 },
  'Nagpur': { south: 21.08, west: 79.00, north: 21.20, east: 79.16, centerLat: 21.1458, centerLon: 79.0882 },
  'Thane': { south: 19.16, west: 72.93, north: 19.28, east: 73.04, centerLat: 19.2183, centerLon: 72.9781 },
  'Navi Mumbai': { south: 18.98, west: 72.98, north: 19.18, east: 73.08, centerLat: 19.0330, centerLon: 73.0297 },
  'Nashik': { south: 19.95, west: 73.74, north: 20.04, east: 73.84, centerLat: 19.9975, centerLon: 73.7898 },
  'Aurangabad': { south: 19.84, west: 75.28, north: 19.92, east: 75.38, centerLat: 19.8762, centerLon: 75.3433 },

  // Karnataka
  'Bengaluru': { south: 12.83, west: 77.46, north: 13.14, east: 77.75, centerLat: 12.9716, centerLon: 77.5946 },
  'Bangalore': { south: 12.83, west: 77.46, north: 13.14, east: 77.75, centerLat: 12.9716, centerLon: 77.5946 },
  'Mysuru': { south: 12.26, west: 76.58, north: 12.36, east: 76.71, centerLat: 12.2958, centerLon: 76.6394 },
  'Mangaluru': { south: 12.84, west: 74.82, north: 12.94, east: 74.92, centerLat: 12.9141, centerLon: 74.8560 },

  // Tamil Nadu
  'Chennai': { south: 12.92, west: 80.12, north: 13.18, east: 80.32, centerLat: 13.0827, centerLon: 80.2707 },
  'Coimbatore': { south: 10.95, west: 76.90, north: 11.08, east: 77.06, centerLat: 11.0168, centerLon: 76.9558 },
  'Madurai': { south: 9.87, west: 78.06, north: 9.98, east: 78.18, centerLat: 9.9252, centerLon: 78.1198 },

  // Telangana & Andhra Pradesh
  'Hyderabad': { south: 17.28, west: 78.32, north: 17.55, east: 78.60, centerLat: 17.3850, centerLon: 78.4867 },
  'Visakhapatnam': { south: 17.65, west: 83.18, north: 17.79, east: 83.37, centerLat: 17.6868, centerLon: 83.2185 },
  'Vijayawada': { south: 16.48, west: 80.58, north: 16.56, east: 80.70, centerLat: 16.5062, centerLon: 80.6480 },

  // Gujarat
  'Ahmedabad': { south: 22.94, west: 72.48, north: 23.12, east: 72.67, centerLat: 23.0225, centerLon: 72.5714 },
  'Surat': { south: 21.12, west: 72.75, north: 21.26, east: 72.90, centerLat: 21.1702, centerLon: 72.8311 },
  'Vadodara': { south: 22.25, west: 73.13, north: 22.37, east: 73.25, centerLat: 22.3072, centerLon: 73.1812 },
  'Rajkot': { south: 22.24, west: 70.75, north: 22.34, east: 70.85, centerLat: 22.3039, centerLon: 70.8022 },

  // West Bengal
  'Kolkata': { south: 22.45, west: 88.27, north: 22.65, east: 88.45, centerLat: 22.5726, centerLon: 88.3639 },
  'Howrah': { south: 22.54, west: 88.28, north: 22.62, east: 88.35, centerLat: 22.5958, centerLon: 88.2636 },

  // Rajasthan
  'Jaipur': { south: 26.82, west: 75.72, north: 26.98, east: 75.88, centerLat: 26.9124, centerLon: 75.7873 },
  'Jodhpur': { south: 26.23, west: 72.97, north: 26.33, east: 73.08, centerLat: 26.2389, centerLon: 73.0243 },
  'Udaipur': { south: 24.54, west: 73.66, north: 24.62, east: 73.74, centerLat: 24.5854, centerLon: 73.7125 },

  // Punjab & Chandigarh
  'Chandigarh': { south: 30.68, west: 76.72, north: 30.79, east: 76.84, centerLat: 30.7333, centerLon: 76.7794 },
  'Ludhiana': { south: 30.85, west: 75.78, north: 30.96, east: 75.92, centerLat: 30.9010, centerLon: 75.8573 },
  'Amritsar': { south: 31.60, west: 74.82, north: 31.68, east: 74.93, centerLat: 31.6340, centerLon: 74.8723 },

  // MP, Bihar, Kerala, Uttarakhand
  'Indore': { south: 22.67, west: 75.80, north: 22.77, east: 75.93, centerLat: 22.7196, centerLon: 75.8577 },
  'Bhopal': { south: 23.18, west: 77.35, north: 23.30, east: 77.48, centerLat: 23.2599, centerLon: 77.4126 },
  'Patna': { south: 25.56, west: 85.06, north: 25.66, east: 85.22, centerLat: 25.5941, centerLon: 85.1376 },
  'Ranchi': { south: 23.30, west: 85.27, north: 23.40, east: 85.39, centerLat: 23.3441, centerLon: 85.3096 },
  'Raipur': { south: 21.20, west: 81.58, north: 21.29, east: 81.69, centerLat: 21.2514, centerLon: 81.6296 },
  'Dehradun': { south: 30.27, west: 77.98, north: 30.38, east: 78.10, centerLat: 30.3165, centerLon: 78.0322 },
  'Kochi': { south: 9.90, west: 76.24, north: 10.02, east: 76.35, centerLat: 9.9312, centerLon: 76.2673 },
  'Thiruvananthapuram': { south: 8.44, west: 76.88, north: 8.56, east: 77.00, centerLat: 8.5241, centerLon: 76.9366 },

  // Canadian Major Cities
  'Toronto': { south: 43.58, west: -79.64, north: 43.86, east: -79.12, centerLat: 43.6532, centerLon: -79.3832 },
  'Ottawa': { south: 45.10, west: -76.35, north: 45.54, east: -75.25, centerLat: 45.4215, centerLon: -75.6972 },
  'Mississauga': { south: 43.48, west: -79.79, north: 43.74, east: -79.54, centerLat: 43.5890, centerLon: -79.6441 },
  'Brampton': { south: 43.62, west: -79.85, north: 43.80, east: -79.64, centerLat: 43.7315, centerLon: -79.7624 },
  'Hamilton': { south: 43.15, west: -80.10, north: 43.35, east: -79.70, centerLat: 43.2557, centerLon: -79.8711 },
  'London': { south: 42.88, west: -81.38, north: 43.08, east: -81.12, centerLat: 42.9849, centerLon: -81.2453 },
  'Markham': { south: 43.80, west: -79.43, north: 43.95, east: -79.20, centerLat: 43.8561, centerLon: -79.3370 },
  'Vaughan': { south: 43.75, west: -79.65, north: 43.90, east: -79.45, centerLat: 43.8563, centerLon: -79.5085 },
  'Kitchener': { south: 43.38, west: -80.55, north: 43.50, east: -80.40, centerLat: 43.4516, centerLon: -80.4925 },
  'Windsor': { south: 42.24, west: -83.10, north: 42.36, east: -82.90, centerLat: 42.3149, centerLon: -83.0364 },
  'Montreal': { south: 45.40, west: -73.98, north: 45.71, east: -73.47, centerLat: 45.5017, centerLon: -73.5673 },
  'Vancouver': { south: 49.19, west: -123.23, north: 49.32, east: -123.02, centerLat: 49.2827, centerLon: -123.1207 },
  'Calgary': { south: 50.84, west: -114.32, north: 51.22, east: -113.86, centerLat: 51.0447, centerLon: -114.0719 },
  'Edmonton': { south: 53.39, west: -113.72, north: 53.66, east: -113.27, centerLat: 53.5461, centerLon: -113.4938 }
};

/**
 * Resolves location across Canada, US, and India to bounding boxes.
 */
export async function resolveLocation(
  countryInput?: string,
  stateName?: string,
  cityName?: string
): Promise<BoundingBox> {
  const normCountry = (countryInput || 'IN').trim().toLowerCase();
  const isCanada = normCountry === 'ca' || normCountry === 'can' || normCountry === 'canada';
  const cleanState = (stateName || '').trim();
  const cleanCity = (cityName || '').trim();

  if (isCanada) {
    if (cleanCity && cleanCity.toLowerCase() !== 'all cities in this state' && cleanCity.toLowerCase() !== 'all cities in this province' && cleanCity !== '') {
      const cacheKey = `ca:${cleanCity.toLowerCase()}, ${cleanState.toLowerCase()}`;
      if (geoCache.has(cacheKey)) {
        return geoCache.get(cacheKey)!;
      }

      // Check curated Canadian cities
      for (const [key, bbox] of Object.entries(MAJOR_CITIES_BOUNDS)) {
        if (key.toLowerCase() === cleanCity.toLowerCase()) {
          geoCache.set(cacheKey, bbox);
          return bbox;
        }
      }

      // Dynamic resolution via Nominatim for Canada
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cleanCity}, ${cleanState}, Canada`)}&countrycodes=ca&format=json&limit=1`;
        const res = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'LeadPilot-Engine/2.1 (contact: team@leadpilot.app)' },
          signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const item = data[0];
            const resolved: BoundingBox = {
              south: parseFloat(item.boundingbox[0]),
              north: parseFloat(item.boundingbox[1]),
              west: parseFloat(item.boundingbox[2]),
              east: parseFloat(item.boundingbox[3]),
              centerLat: parseFloat(item.lat),
              centerLon: parseFloat(item.lon)
            };
            geoCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      } catch {}
    }

    // Check province bounds (e.g. Ontario)
    for (const [key, bbox] of Object.entries(STATE_BOUNDS)) {
      if (key.toLowerCase() === cleanState.toLowerCase()) {
        return bbox;
      }
    }

    return CANADA_PAN_BOUNDS;
  }

  // Fallback to resolveIndiaLocation
  return resolveIndiaLocation(cleanState, cleanCity, countryInput);
}

/**
 * Resolves a state and optional city to a search bounding box in India or specified country.
 */
export async function resolveIndiaLocation(
  stateName: string,
  cityName?: string,
  countryInput?: string
): Promise<BoundingBox> {
  const normCountry = (countryInput || '').trim().toLowerCase();
  const isCanada = normCountry === 'ca' || normCountry === 'can' || normCountry === 'canada' || stateName?.toLowerCase() === 'ontario';
  if (isCanada) {
    return resolveLocation('CA', stateName, cityName);
  }

  const cleanState = stateName.trim();
  const cleanCity = cityName?.trim();

  // 1. Check if specific city is in our major cities dictionary
  if (cleanCity && cleanCity.toLowerCase() !== 'all cities in this state' && cleanCity !== '') {
    const cacheKey = `${cleanCity.toLowerCase()}, ${cleanState.toLowerCase()}`;
    if (geoCache.has(cacheKey)) {
      return geoCache.get(cacheKey)!;
    }

    // Direct match against curated city boundaries
    for (const [key, bbox] of Object.entries(MAJOR_CITIES_BOUNDS)) {
      if (key.toLowerCase() === cleanCity.toLowerCase()) {
        geoCache.set(cacheKey, bbox);
        return bbox;
      }
    }

    // Dynamic resolution via cached Nominatim with strict Indian countrycode
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cleanCity}, ${cleanState}, India`)}&countrycodes=in&format=json&limit=1`;
      const res = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'LeadPilot-Engine/2.1 (contact: team@leadpilot.app)' },
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const south = parseFloat(item.boundingbox[0]);
          const north = parseFloat(item.boundingbox[1]);
          const west = parseFloat(item.boundingbox[2]);
          const east = parseFloat(item.boundingbox[3]);
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);

          const resolved: BoundingBox = {
            south,
            west,
            north,
            east,
            centerLat: lat,
            centerLon: lon
          };
          geoCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    } catch {
      // Fallback to state bounds
    }
  }

  // 2. Check if State has defined bounds
  for (const [key, bbox] of Object.entries(STATE_BOUNDS)) {
    if (key.toLowerCase() === cleanState.toLowerCase()) {
      return bbox;
    }
  }

  // 3. Fallback: Generic India bounding box (replaces city-specific Delhi fallback)
  return INDIA_PAN_BOUNDS;
}

/**
 * Strict Location Verification:
 * Validates that discovered latitude and longitude truly falls inside the requested city/state.
 * Rejects out-of-boundary POIs (e.g. Delhi POIs when Noida was requested).
 */
export function isCoordinateInLocation(
  lat: number,
  lon: number,
  cityName?: string,
  stateName?: string
): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return false;
  }

  let effCity = cityName?.trim();
  let effState = stateName?.trim();

  // Inversion guard: If effCity matches a known State and effState matches a known Major City, swap them
  if (effCity && effState) {
    const isCityStateName = Object.keys(STATE_BOUNDS).some((s) => s.toLowerCase() === effCity!.toLowerCase());
    const isStateCityName = Object.keys(MAJOR_CITIES_BOUNDS).some((c) => c.toLowerCase() === effState!.toLowerCase());
    if (isCityStateName && (isStateCityName || !Object.keys(STATE_BOUNDS).some((s) => s.toLowerCase() === effState!.toLowerCase()))) {
      const temp = effCity;
      effCity = effState;
      effState = temp;
    }
  }

  // If city is specified, check against city bounds
  if (effCity && effCity.toLowerCase() !== 'all cities in this state' && effCity !== '') {
    let cityBbox: BoundingBox | undefined;

    for (const [key, bbox] of Object.entries(MAJOR_CITIES_BOUNDS)) {
      if (key.toLowerCase() === effCity.toLowerCase()) {
        cityBbox = bbox;
        break;
      }
    }

    if (!cityBbox && effState) {
      const cacheKey = `${effCity.toLowerCase()}, ${effState.toLowerCase()}`;
      cityBbox = geoCache.get(cacheKey);
    }

    if (cityBbox) {
      // 0.03 degree margin of tolerance (~3km) for border venues
      const buffer = 0.03;
      const insideLat = lat >= cityBbox.south - buffer && lat <= cityBbox.north + buffer;
      const insideLon = lon >= cityBbox.west - buffer && lon <= cityBbox.east + buffer;
      return insideLat && insideLon;
    }
  }

  // If state is specified, verify against state bounds
  if (effState) {
    for (const [key, bbox] of Object.entries(STATE_BOUNDS)) {
      if (key.toLowerCase() === effState.toLowerCase()) {
        const buffer = 0.05;
        const insideLat = lat >= bbox.south - buffer && lat <= bbox.north + buffer;
        const insideLon = lon >= bbox.west - buffer && lon <= bbox.east + buffer;
        return insideLat && insideLon;
      }
    }
  }

  return true;
}
