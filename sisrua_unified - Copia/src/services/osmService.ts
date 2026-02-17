import { OverpassResponse, OsmElement } from '../types';
import { OVERPASS_API_ENDPOINTS } from '../constants';
import Logger from '../utils/logger';

export const fetchOsmData = async (lat: number, lng: number, radius: number): Promise<OsmElement[]> => {
  const query = `
    [out:json][timeout:60];
    (
      nwr(around:${radius},${lat},${lng});
    );
    out body geom qt;
  `;

  const requestBody = `data=${encodeURIComponent(query)}`;

  const fetchWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        method: 'POST',
        body: requestBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    Logger.debug(`Fetching OSM data for lat: ${lat}, lng: ${lng}, radius: ${radius}m`);

    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_API_ENDPOINTS) {
      try {
        Logger.debug(`Overpass endpoint: ${endpoint}`);
        const response = await fetchWithTimeout(endpoint, 30000);

        if (!response.ok) {
          throw new Error(`Overpass API Error: ${response.status} ${response.statusText}`);
        }

        const data: OverpassResponse = await response.json();
        Logger.info(`Fetched ${data.elements.length} OSM elements`);
        return data.elements;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.warn(`Overpass endpoint failed: ${endpoint}`, message);
        lastError = error instanceof Error ? error : new Error(message);
      }
    }

    throw lastError || new Error('All Overpass endpoints failed');
  } catch (error) {
    Logger.error("Failed to fetch OSM data", error);
    throw error;
  }
};
