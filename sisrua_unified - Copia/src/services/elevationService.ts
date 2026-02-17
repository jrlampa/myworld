import { GeoLocation, TerrainGrid, TerrainPoint } from '../types';
import Logger from '../utils/logger';

export const fetchElevationGrid = async (center: GeoLocation, radius: number, gridSize: number = 12): Promise<TerrainGrid> => {
  // Bounding box calculation
  const R = 6378137; // Earth radius

  // Calculate delta Lat/Lng for the radius
  const dLat = (radius / R) * (180 / Math.PI);
  // Adjust lng delta based on latitude
  const dLng = (radius / (R * Math.cos(center.lat * Math.PI / 180))) * (180 / Math.PI);

  // We want a square grid covering the circle
  const minLat = center.lat - dLat;
  const maxLat = center.lat + dLat;
  const minLng = center.lng - dLng;
  const maxLng = center.lng + dLng;

  const latStep = (maxLat - minLat) / (gridSize - 1);
  const lngStep = (maxLng - minLng) / (gridSize - 1);

  const lats: number[] = [];
  const lngs: number[] = [];

  // Generate grid points (row by row)
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      lats.push(minLat + i * latStep);
      lngs.push(minLng + j * lngStep);
    }
  }

  // Open-Meteo Elevation API
  // Note: Open-Meteo takes comma-separated lists. Use batching to avoid URL limits.
  const batchSize = 100;

  try {
    Logger.debug(`Fetching elevation grid for ${gridSize}x${gridSize} points`);
    const elevations: number[] = [];

    for (let offset = 0; offset < lats.length; offset += batchSize) {
      const latChunk = lats.slice(offset, offset + batchSize);
      const lngChunk = lngs.slice(offset, offset + batchSize);

      const url = `https://api.open-meteo.com/v1/elevation?latitude=${latChunk.map(l => l.toFixed(6)).join(',')}&longitude=${lngChunk.map(l => l.toFixed(6)).join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch terrain data');
      const data = await response.json();
      const chunkElevations = data.elevation as number[];

      if (!chunkElevations || chunkElevations.length !== latChunk.length) {
        throw new Error("Invalid elevation data received");
      }

      elevations.push(...chunkElevations);
    }

    // Reconstruct into 2D grid
    const grid: TerrainGrid = [];
    let idx = 0;
    for (let i = 0; i < gridSize; i++) {
      const row: TerrainPoint[] = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({
          lat: lats[idx],
          lng: lngs[idx],
          elevation: elevations[idx] || 0
        });
        idx++;
      }
      grid.push(row);
    }
    
    Logger.info(`Elevation grid fetched successfully with ${elevations.length} points`);
    return grid;

  } catch (error) {
    Logger.error("Elevation API Error", error);
    // Return flat grid on error so app doesn't crash, just flat terrain
    const grid: TerrainGrid = [];
    for (let i = 0; i < gridSize; i++) {
      const row: TerrainPoint[] = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({
          lat: minLat + i * latStep,
          lng: minLng + j * lngStep,
          elevation: 0
        });
      }
      grid.push(row);
    }
    return grid;
  }
};

/**
 * Fetches elevation profile from backend (Smart Backend Refinement)
 */
export const fetchElevationProfile = async (start: GeoLocation, end: GeoLocation) => {
  try {
    Logger.debug('Fetching elevation profile');
    const response = await fetch('/api/elevation/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, steps: 25 })
    });

    if (!response.ok) throw new Error('Failed to fetch elevation profile');
    const data = await response.json();
    Logger.info('Elevation profile fetched successfully');
    return data.profile;
  } catch (error) {
    Logger.error('Error fetching elevation profile:', error);
    return [];
  }
};
