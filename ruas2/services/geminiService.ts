
import { GeoLocation } from '../types';
import { utmToLatLon } from '../utils/geoMath';

const API_URL = 'http://localhost:3000/api';

/**
 * Tries to parse coordinates from a string.
 * Supports:
 * - "24K 208906 7520980" (UTM)
 * - "-23.5505, -46.6333"
 * - "-23.5505 -46.6333"
 * - "Lat: -23.55, Lon: -46.63"
 */
const parseCoordinates = (input: string): GeoLocation | null => {
  const cleanInput = input.trim().toUpperCase();

  // 1. UTM Detection (e.g., "24K 208906 7520980" or "24K 208906.5 7520980.1")
  // Regex: Zone (1-2 digits), Space?, Band (Letter), Space, Easting (6+ digits), Space, Northing (7+ digits)
  const utmRegex = /^(\d{1,2})\s?([C-X])\s+(\d{6,}(?:\.\d+)?)\s+(\d{7,}(?:\.\d+)?)$/;
  const utmMatch = cleanInput.match(utmRegex);

  if (utmMatch) {
      const zone = parseInt(utmMatch[1], 10);
      const band = utmMatch[2];
      const easting = parseFloat(utmMatch[3]);
      const northing = parseFloat(utmMatch[4]);

      // Determine hemisphere from band
      // Bands C..M are South, N..X are North
      const hemisphere = (band >= 'N') ? 'N' : 'S';

      const converted = utmToLatLon(zone, hemisphere, easting, northing);
      if (converted) {
          return {
              lat: converted.lat,
              lng: converted.lng,
              label: `UTM Zone ${zone}${band} E:${easting} N:${northing}`
          };
      }
  }

  // 2. Standard Lat/Lon Parsing
  const numberPattern = /[-+]?([0-9]*\.[0-9]+|[0-9]+)/g;
  const numbers = cleanInput.match(numberPattern);

  if (numbers && numbers.length >= 2) {
    const hasCoordinateKeywords = /LAT|LON|NORTH|SOUTH|EAST|WEST|°/i.test(cleanInput);
    // Strict check: input contains only numbers, spaces, commas, or dot
    const isStrictPair = /^[-\d\.\s,]+$/.test(cleanInput);

    if (hasCoordinateKeywords || isStrictPair) {
      let lat = parseFloat(numbers[0]);
      let lng = parseFloat(numbers[1]);

      if (/S|SOUTH/i.test(cleanInput)) lat = -Math.abs(lat);
      if (/W|WEST/i.test(cleanInput)) lng = -Math.abs(lng);
      
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return {
          lat,
          lng,
          label: `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        };
      }
    }
  }
  return null;
};

export const findLocation = async (query: string, enableAI: boolean): Promise<GeoLocation | null> => {
  
  // 1. Try "Smart Parse" for explicit coordinates (UTM or Lat/Lon)
  const directCoords = parseCoordinates(query);
  if (directCoords) {
    return directCoords;
  }

  // 2. Try AI Search (Gemini) if enabled
  if (enableAI) {
    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn("Backend/AI Search Error, falling back to standard search:", error);
    }
  }

  // 3. Fallback to OpenStreetMap Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(nominatimUrl);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name
      };
    }
  } catch (error) {
    console.error("Nominatim Search Error:", error);
  }

  return null;
};

export const analyzeArea = async (stats: any, locationName: string, enableAI: boolean): Promise<string> => {
  if (!enableAI) return "AI Analysis disabled by user.";

  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, locationName })
    });
    if (!response.ok) return "Analysis failed.";
    const data = await response.json();
    return data.analysis;
  } catch (e) {
    return "Could not contact analysis backend.";
  }
};
