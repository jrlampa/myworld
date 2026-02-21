import { OsmElement, GeoLocation, TerrainGrid } from '../types';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

type DxfQueueResponse = {
  status: 'queued';
  jobId: string | number;
};

type DxfCachedResponse = {
  status: 'success';
  url: string;
  message?: string;
};

type DxfJobResult = {
  url: string;
  filename?: string;
};

type DxfJobStatus = {
  id: string | number;
  status: string;
  progress: number;
  result: DxfJobResult | null;
  error: string | null;
};

export const generateDXF = async (
  lat: number,
  lon: number,
  radius: number,
  mode: string,
  polygon: any[],
  layers: Record<string, boolean>,
  projection: 'local' | 'utm' = 'local',
  aneelProdist: boolean = false
): Promise<DxfQueueResponse | DxfCachedResponse> => {

  const response = await fetch(`${API_URL}/dxf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, radius, mode, polygon, layers, projection, aneel_prodist: aneelProdist })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Backend generation failed');
  }

  return await response.json();
};

export const getDxfJobStatus = async (jobId: string): Promise<DxfJobStatus> => {
  const response = await fetch(`${API_URL}/jobs/${jobId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || errorData.error || 'Failed to load job status');
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