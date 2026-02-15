import { OverpassResponse, OsmElement } from '../types';
import { OVERPASS_API_URL } from '../constants';

export const fetchOsmData = async (lat: number, lng: number, radius: number): Promise<OsmElement[]> => {
  // Query to get nodes, ways, relations around a point.
  // We use [out:json]; and output geometry (out geom) to get coordinates embedded in ways.
  const query = `
    [out:json][timeout:25];
    (
      nwr(around:${radius},${lat},${lng});
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Overpass API Error: ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    return data.elements;
  } catch (error) {
    console.error("Failed to fetch OSM data", error);
    throw error;
  }
};
