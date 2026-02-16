
import { GeoLocation, TerrainGrid, TerrainPoint } from '../types';

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const getBoundsFromRadius = (center: GeoLocation, radius: number): Bounds => {
  const R = 6378137; // Earth radius
  const dLat = (radius / R) * (180 / Math.PI);
  const dLng = (radius / (R * Math.cos(center.lat * Math.PI / 180))) * (180 / Math.PI);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng
  };
};

export const fetchElevationGrid = async (center: GeoLocation, radius: number, polygon?: GeoLocation[], gridSize: number = 12): Promise<TerrainGrid> => {
  
  let bounds: Bounds;

  // Calculate Bounds
  if (polygon && polygon.length > 0) {
    const lats = polygon.map(p => p.lat);
    const lngs = polygon.map(p => p.lng);
    bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
    // Add a small buffer to polygon bounds to ensure coverage
    const latBuffer = (bounds.maxLat - bounds.minLat) * 0.1 || 0.001;
    const lngBuffer = (bounds.maxLng - bounds.minLng) * 0.1 || 0.001;
    bounds.minLat -= latBuffer;
    bounds.maxLat += latBuffer;
    bounds.minLng -= lngBuffer;
    bounds.maxLng += lngBuffer;
  } else {
    bounds = getBoundsFromRadius(center, radius);
  }

  const latStep = (bounds.maxLat - bounds.minLat) / (gridSize - 1);
  const lngStep = (bounds.maxLng - bounds.minLng) / (gridSize - 1);

  const lats: number[] = [];
  const lngs: number[] = [];

  // Generate grid points (row by row)
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      lats.push(bounds.minLat + i * latStep);
      lngs.push(bounds.minLng + j * lngStep);
    }
  }

  // Create a default flat grid generator
  const createFlatGrid = (): TerrainGrid => {
      const grid: TerrainGrid = [];
      let idx = 0;
      for (let i = 0; i < gridSize; i++) {
          const row: TerrainPoint[] = [];
          for (let j = 0; j < gridSize; j++) {
              row.push({
                  lat: lats[idx] || bounds.minLat,
                  lng: lngs[idx] || bounds.minLng,
                  elevation: 0
              });
              idx++;
          }
          grid.push(row);
      }
      return grid;
  };

  // Open-Meteo Elevation API
  // Using simplified query to avoid URL length issues
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.map(l => l.toFixed(6)).join(',')}&longitude=${lngs.map(l => l.toFixed(6)).join(',')}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.warn('Elevation API returned non-OK status. Using flat terrain.');
        return createFlatGrid();
    }
    
    const data = await response.json();
    const elevations = data.elevation as number[];

    if (!elevations || elevations.length !== lats.length) {
        console.warn("Invalid elevation data structure received. Using flat terrain.");
        return createFlatGrid();
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
    console.error("Elevation API Error (Network or parsing):", e);
    // Return flat grid on error to allow the app to proceed
    return createFlatGrid();
  }
};
