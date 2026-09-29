/**
 * Geographic Resolver for India
 * Resolves Indian States, Union Territories, and Cities into bounding boxes (south, west, north, east)
 * for high-performance OpenStreetMap / Overpass queries without full-table area scans.
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

// Known bounding boxes and centers for major Indian states/UTs
export const STATE_BOUNDS: Record<string, BoundingBox> = {
  'Delhi': { south: 28.40, west: 76.84, north: 28.88, east: 77.35, centerLat: 28.6139, centerLon: 77.2090 },
  'Chandigarh': { south: 30.68, west: 76.72, north: 30.79, east: 76.84, centerLat: 30.7333, centerLon: 76.7794 },
  'Goa': { south: 14.90, west: 73.68, north: 15.80, east: 74.34, centerLat: 15.2993, centerLon: 74.1240 },
  'Puducherry': { south: 11.85, west: 79.75, north: 12.05, east: 79.88, centerLat: 11.9416, centerLon: 79.8083 },
  'Uttar Pradesh': { south: 25.50, west: 77.10, north: 28.95, east: 83.50, centerLat: 26.8467, centerLon: 80.9462 },
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
  'Ladakh': { south: 32.20, west: 75.50, north: 36.00, east: 79.50, centerLat: 34.1526, centerLon: 77.5771 }
};

// Known bounding boxes for popular cities in India (~10-25km area)
export const MAJOR_CITIES_BOUNDS: Record<string, BoundingBox> = {
  // NCR
  'Noida': { south: 28.48, west: 77.30, north: 28.64, east: 77.44, centerLat: 28.5355, centerLon: 77.3910 },
  'Greater Noida': { south: 28.42, west: 77.45, north: 28.55, east: 77.58, centerLat: 28.4744, centerLon: 77.5040 },
  'Gurugram': { south: 28.38, west: 76.95, north: 28.52, east: 77.12, centerLat: 28.4595, centerLon: 77.0266 },
  'Gurgaon': { south: 28.38, west: 76.95, north: 28.52, east: 77.12, centerLat: 28.4595, centerLon: 77.0266 },
  'Ghaziabad': { south: 28.60, west: 77.35, north: 28.74, east: 77.50, centerLat: 28.6692, centerLon: 77.4538 },
  'Faridabad': { south: 28.32, west: 77.25, north: 28.46, east: 77.38, centerLat: 28.4089, centerLon: 77.3178 },
  'Delhi': { south: 28.45, west: 77.00, north: 28.80, east: 77.35, centerLat: 28.6139, centerLon: 77.2090 },
  'New Delhi': { south: 28.55, west: 77.15, north: 28.67, east: 77.27, centerLat: 28.6139, centerLon: 77.2090 },

  // Maharashtra
  'Mumbai': { south: 18.89, west: 72.77, north: 19.28, east: 72.99, centerLat: 19.0760, centerLon: 72.8777 },
  'Pune': { south: 18.42, west: 73.75, north: 18.62, east: 73.98, centerLat: 18.5204, centerLon: 73.8567 },
  'Nagpur': { south: 21.08, west: 79.00, north: 21.20, east: 79.16, centerLat: 21.1458, centerLon: 79.0882 },
  'Thane': { south: 19.16, west: 72.93, north: 19.28, east: 73.04, centerLat: 19.2183, centerLon: 72.9781 },
  'Navi Mumbai': { south: 18.98, west: 72.98, north: 19.18, east: 73.08, centerLat: 19.0330, centerLon: 73.0297 },

  // Karnataka
  'Bengaluru': { south: 12.83, west: 77.46, north: 13.14, east: 77.75, centerLat: 12.9716, centerLon: 77.5946 },
  'Bangalore': { south: 12.83, west: 77.46, north: 13.14, east: 77.75, centerLat: 12.9716, centerLon: 77.5946 },
  'Mysuru': { south: 12.26, west: 76.58, north: 12.36, east: 76.71, centerLat: 12.2958, centerLon: 76.6394 },

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

  // West Bengal
  'Kolkata': { south: 22.45, west: 88.27, north: 22.65, east: 88.45, centerLat: 22.5726, centerLon: 88.3639 },

  // Rajasthan
  'Jaipur': { south: 26.82, west: 75.72, north: 26.98, east: 75.88, centerLat: 26.9124, centerLon: 75.7873 },
  'Jodhpur': { south: 26.23, west: 72.97, north: 26.33, east: 73.08, centerLat: 26.2389, centerLon: 73.0243 },

  // Uttar Pradesh
  'Lucknow': { south: 26.78, west: 80.85, north: 26.95, east: 81.04, centerLat: 26.8467, centerLon: 80.9462 },
  'Kanpur': { south: 26.40, west: 80.25, north: 26.52, east: 80.40, centerLat: 26.4499, centerLon: 80.3319 },
  'Varanasi': { south: 25.26, west: 82.94, north: 25.37, east: 83.05, centerLat: 25.3176, centerLon: 82.9739 },
  'Agra': { south: 27.12, west: 77.94, north: 27.24, east: 78.07, centerLat: 27.1767, centerLon: 78.0081 },

  // Punjab & Haryana & HP
  'Chandigarh': { south: 30.68, west: 76.72, north: 30.79, east: 76.84, centerLat: 30.7333, centerLon: 76.7794 },
  'Ludhiana': { south: 30.85, west: 75.78, north: 30.96, east: 75.92, centerLat: 30.9010, centerLon: 75.8573 },
  'Amritsar': { south: 31.60, west: 74.82, north: 31.68, east: 74.93, centerLat: 31.6340, centerLon: 74.8723 },
  'Shimla': { south: 31.06, west: 77.12, north: 31.14, east: 77.22, centerLat: 31.1048, centerLon: 77.1734 },

  // Madhya Pradesh & Bihar
  'Indore': { south: 22.67, west: 75.80, north: 22.77, east: 75.93, centerLat: 22.7196, centerLon: 75.8577 },
  'Bhopal': { south: 23.18, west: 77.35, north: 23.30, east: 77.48, centerLat: 23.2599, centerLon: 77.4126 },
  'Patna': { south: 25.56, west: 85.06, north: 25.66, east: 85.22, centerLat: 25.5941, centerLon: 85.1376 },
  'Ranchi': { south: 23.30, west: 85.27, north: 23.40, east: 85.39, centerLat: 23.3441, centerLon: 85.3096 },
  'Raipur': { south: 21.20, west: 81.58, north: 21.29, east: 81.69, centerLat: 21.2514, centerLon: 81.6296 },
  'Dehradun': { south: 30.27, west: 77.98, north: 30.38, east: 78.10, centerLat: 30.3165, centerLon: 78.0322 },
  'Kochi': { south: 9.90, west: 76.24, north: 10.02, east: 76.35, centerLat: 9.9312, centerLon: 76.2673 },
  'Thiruvananthapuram': { south: 8.44, west: 76.88, north: 8.56, east: 77.00, centerLat: 8.5241, centerLon: 76.9366 }
};

/**
 * Resolves a state and optional city to a search bounding box in India.
 */
export async function resolveIndiaLocation(
  stateName: string,
  cityName?: string
): Promise<BoundingBox> {
  const cleanState = stateName.trim();
  const cleanCity = cityName?.trim();

  // 1. Check if specific city is in our major cities dictionary
  if (cleanCity && cleanCity.toLowerCase() !== 'all cities in this state' && cleanCity !== '') {
    const cacheKey = `${cleanCity.toLowerCase()}, ${cleanState.toLowerCase()}`;
    if (geoCache.has(cacheKey)) {
      return geoCache.get(cacheKey)!;
    }

    // Check direct major cities
    for (const [key, bbox] of Object.entries(MAJOR_CITIES_BOUNDS)) {
      if (key.toLowerCase() === cleanCity.toLowerCase()) {
        geoCache.set(cacheKey, bbox);
        return bbox;
      }
    }

    // Try dynamic resolution via Nominatim (with 3-second timeout and cache)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${cleanCity}, ${cleanState}, India`)}&countrycodes=in&format=json&limit=1`;
      const res = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'LeadPilot/1.0 (https://leadpilot.app; support@leadpilot.app)' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          // bbox: [south, north, west, east]
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
      // Ignore network timeout on Nominatim and fallback to state
    }
  }

  // 2. Check if State has defined bounds
  for (const [key, bbox] of Object.entries(STATE_BOUNDS)) {
    if (key.toLowerCase() === cleanState.toLowerCase()) {
      return bbox;
    }
  }

  // 3. Fallback: Default to central Delhi / NCR if unknown
  return STATE_BOUNDS['Delhi'];
}
