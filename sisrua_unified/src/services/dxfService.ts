import { OsmElement, GeoLocation, TerrainGrid } from '../types';

const API_URL = 'http://localhost:3001/api';

export const generateDXF = async (
  lat: number,
  lon: number,
  radius: number,
  mode: string,
  polygon: any[],
  layers: Record<string, boolean>,
  projection: 'local' | 'utm' = 'local'
): Promise<{ url: string }> => {

  const response = await fetch(`${API_URL}/dxf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, radius, mode, polygon, layers, projection })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Backend generation failed');
  }

  return await response.json();
};

export const calculateStats = (elements: OsmElement[]) => {
  // We keep stats calculation on frontend for immediate dashboard feedback
  // before the user decides to download the DXF.
  let buildings = 0;
  let roads = 0;
  let nature = 0;
  let totalHeight = 0;
  let heightCount = 0;
  let maxHeight = 0;

  elements.forEach(el => {
    if (el.tags?.building) buildings++;
    if (el.tags?.highway) roads++;
    if (el.tags?.natural || el.tags?.landuse) nature++;

    // Simple height check for stats
    let h = 0;
    if (el.tags?.height) h = parseFloat(el.tags.height);
    else if (el.tags?.['building:levels']) h = parseFloat(el.tags['building:levels']) * 3.2;

    if (h > 0) {
      totalHeight += h;
      heightCount++;
      if (h > maxHeight) maxHeight = h;
    }
  });

  return {
    totalBuildings: buildings,
    totalRoads: roads,
    totalNature: nature,
    avgHeight: heightCount > 0 ? totalHeight / heightCount : 0,
    maxHeight
  };
};