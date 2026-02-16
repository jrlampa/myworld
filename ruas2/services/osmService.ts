import { OverpassResponse, OsmElement, GeoLocation } from '../types';
import { OVERPASS_API_URL } from '../constants';

export const fetchOsmData = async (lat: number, lng: number, radius: number): Promise<OsmElement[]> => {
  // Query to get nodes, ways, relations around a point.
  // Increased timeout to 90s to prevent Gateway Timeouts on dense areas
  const query = `
    [out:json][timeout:90];
    (
      nwr(around:${radius},${lat},${lng});
    );
    out geom;
  `;
  return executeQuery(query);
};

export const fetchOsmDataPolygon = async (polygon: GeoLocation[]): Promise<OsmElement[]> => {
  if (polygon.length < 3) return [];

  // Overpass poly filter expects "lat1 lon1 lat2 lon2 ..."
  const polyString = polygon.map(p => `${p.lat} ${p.lng}`).join(' ');

  // Increased timeout to 90s to prevent Gateway Timeouts on dense areas
  const query = `
    [out:json][timeout:90];
    (
      nwr(poly:"${polyString}");
    );
    out geom;
  `;
  return executeQuery(query);
};

const executeQuery = async (query: string): Promise<OsmElement[]> => {
  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error("Erro de Timeout (504): A área selecionada é muito densa ou o servidor OSM está ocupado. Tente reduzir o raio.");
      }
      throw new Error(`Overpass API Error: ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    return data.elements;
  } catch (error: any) {
    console.error("Failed to fetch OSM data", error);
    throw error;
  }
};