import { GeoLocation, TerrainGrid, TerrainPoint } from '../types';

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
  // Note: Open-Meteo takes comma-separated lists. URL length limits apply, but 144 points is fine.
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.map(l => l.toFixed(6)).join(',')}&longitude=${lngs.map(l => l.toFixed(6)).join(',')}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch terrain data');
    const data = await response.json();
    const elevations = data.elevation as number[];

    if (!elevations || elevations.length !== lats.length) {
        throw new Error("Invalid elevation data received");
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
    return grid;

  } catch (e) {
    console.error("Elevation API Error", e);
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
