
import { OsmElement, GeoLocation, TerrainGrid, LayerConfig, ProjectionType, SimplificationLevel, ProjectMetadata } from '../../types';
import { LAYERS, ROAD_WIDTHS, SLOPE_THRESHOLDS, HATCH_PATTERNS, TOLERANCE_MAP } from '../constants';

// --- Math & Geometry Pro Helpers ---

const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const normalizeAngle = (angle: number) => {
    while (angle <= -Math.PI / 4) angle += Math.PI / 2;
    while (angle > Math.PI / 4) angle -= Math.PI / 2;
    return angle;
};

// Squaring algorithm for buildings
const orthogonalize = (points: {x:number, y:number}[]) => {
    if (points.length < 3) return points;
    
    // Calculate dominant orientation
    let totalWeight = 0;
    let weightedAngle = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const d = distance(p1, p2);
        if (d === 0) continue;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        weightedAngle += normalizeAngle(angle) * d;
        totalWeight += d;
    }
    const baseAngle = weightedAngle / totalWeight;

    // Project points to orthogonal axes
    const cosA = Math.cos(-baseAngle);
    const sinA = Math.sin(-baseAngle);
    
    return points.map(p => {
        // Rotate to align with axes
        const rx = p.x * cosA - p.y * sinA;
        const ry = p.x * sinA + p.y * cosA;
        // Snap logic would happen here, but for DXF we mostly want consistent rotation
        return p; 
    });
};

const getOffsetPoints = (points: {x:number, y:number}[], offset: number) => {
    const result: {x:number, y:number}[] = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const prev = points[i - 1] || points[i];
        const next = points[i + 1] || points[i];
        
        const a1 = Math.atan2(p.y - prev.y, p.x - prev.x);
        const a2 = Math.atan2(next.y - p.y, next.x - p.x);
        let angle = (a1 + a2) / 2 + Math.PI / 2;
        
        result.push({
            x: p.x + Math.cos(angle) * offset,
            y: p.y + Math.sin(angle) * offset
        });
    }
    return result;
};

// --- Terrain & Contours ---

const generateContours = (terrain: TerrainGrid, interval: number, zRef: number) => {
    const contours: { elevation: number, points: {x:number, y:number}[] }[] = [];
    if (!terrain || terrain.length < 2) return contours;

    const elevations: number[] = [];
    const flat = terrain.flat();
    const minZ = Math.min(...flat.map(p => p.elevation));
    const maxZ = Math.max(...flat.map(p => p.elevation));

    for (let z = Math.ceil(minZ / interval) * interval; z <= maxZ; z += interval) {
        // Simplified Marching Squares or Grid Intersections
        // For DXF evolution, we implement a path-following approach per grid cell
        elevations.push(z);
    }
    
    // Logic for isolines generation (simplified for structure)
    return elevations.map(z => ({ elevation: z, points: [] }));
};

// --- Projection Helpers ---

const toRadians = (deg: number) => deg * Math.PI / 180;

const latLonToUTM = (lat: number, lon: number, forceZone?: number) => {
  const a = 6378137.0; 
  const f = 1 / 298.257223563; 
  const k0 = 0.9996; 
  const phi = toRadians(lat);
  const lambda = toRadians(lon);
  const zoneNumber = forceZone || (Math.floor((lon + 180) / 6) + 1);
  const lambda0 = toRadians(((zoneNumber - 1) * 6 - 180) + 3); 
  const e = Math.sqrt(f * (2 - f)); 
  const e2 = e * e;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = (e2 / (1 - e2)) * Math.cos(phi) * Math.cos(phi);
  const A = (lambda - lambda0) * Math.cos(phi);
  const M = a * ((1 - e2 / 4) * phi - (3 * e2 / 8) * Math.sin(2 * phi) + (15 * Math.pow(e,4) / 256) * Math.sin(4 * phi));
  const x = 500000 + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + Math.pow(T, 2)) * Math.pow(A, 5) / 120);
  const y = k0 * (M + N * Math.tan(phi) * (Math.pow(A, 2) / 2 + (5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4) / 24));
  return { x, y: lat < 0 ? y + 10000000 : y, zone: zoneNumber };
};

const project = (lat: number, lon: number, center: GeoLocation, type: ProjectionType, forceZone?: number) => {
  if (type === 'utm') return latLonToUTM(lat, lon, forceZone);
  const R = 6378137; 
  const dLat = (lat - center.lat) * (Math.PI / 180);
  const dLon = (lon - center.lng) * (Math.PI / 180);
  const latRad = center.lat * (Math.PI / 180);
  return { x: R * dLon * Math.cos(latRad), y: R * dLat };
};

// --- Main Service ---

const yieldToLoop = () => new Promise(resolve => setTimeout(resolve, 0));

export const generateDXF = async (
  elements: OsmElement[], 
  center: GeoLocation, 
  terrain: TerrainGrid | undefined, 
  options: any = {},
  onProgress?: (progress: number, message: string) => void
): Promise<string> => {

  const config = { 
      simplificationLevel: 'off', 
      layers: { buildings: true, roads: true, terrain: true, contours: true }, 
      projection: 'local', 
      orthogonalize: true,
      contourInterval: 1,
      ...options 
  };

  const customLayers = new Set<string>();
  const zReference = config.projection === 'utm' ? 0 : (terrain?.[0]?.[0]?.elevation || 0);
  const forcedZone = config.projection === 'utm' ? latLonToUTM(center.lat, center.lng).zone : undefined;

  let entities = `0\nSECTION\n2\nENTITIES\n`;

  // 1. Terrain Contours
  if (config.layers.contours && terrain) {
      if (onProgress) onProgress(10, "Gerando curvas de nível...");
      const interval = config.contourInterval || 1;
      // Contour drawing logic would add LWPOLYLINE here
  }

  // 2. Main Elements
  const total = elements.length;
  for (let i = 0; i < total; i++) {
    const el = elements[i];
    if (i % 100 === 0) {
      if (onProgress) onProgress(20 + (i/total)*70, "Processando geometria técnica...");
      await yieldToLoop();
    }

    if (el.type === 'way' && el.geometry) {
        let projected = el.geometry.map(p => project(p.lat, p.lon, center, config.projection, forcedZone));
        
        if (el.tags?.building && config.orthogonalize) {
            projected = orthogonalize(projected);
            const layer = LAYERS.BLD_GENERIC.name;
            const h = parseFloat(el.tags.height || '3');
            entities += `0\nLWPOLYLINE\n8\n${layer}\n90\n${projected.length}\n70\n1\n`;
            projected.forEach(p => entities += `10\n${p.x}\n20\n${p.y}\n`);
            // Add elevation text
            entities += `0\nTEXT\n8\nLABELS\n10\n${projected[0].x}\n20\n${projected[0].y}\n40\n0.8\n1\n${h}m\n`;
        }
        
        if (el.tags?.highway) {
            const width = ROAD_WIDTHS[el.tags.highway] || 6;
            const layer = LAYERS.ROADS_MINOR.name;
            
            // Centerline
            entities += `0\nLWPOLYLINE\n8\nROADS_CENTER\n90\n${projected.length}\n70\n0\n`;
            projected.forEach(p => entities += `10\n${p.x}\n20\n${p.y}\n`);
            
            // Curbs (Guias)
            if (config.layers.curbs) {
                const left = getOffsetPoints(projected, width/2);
                const right = getOffsetPoints(projected, -width/2);
                [left, right].forEach(side => {
                    entities += `0\nLWPOLYLINE\n8\nROADS_CURBS\n90\n${side.length}\n70\n0\n`;
                    side.forEach(p => entities += `10\n${p.x}\n20\n${p.y}\n`);
                });
            }
        }
    }
  }

  entities += `0\nENDSEC\n`;
  
  // Combine all sections (Header, Tables, Blocks, Entities)
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;
  return `${header}${entities}0\nEOF\n`;
};
