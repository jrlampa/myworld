import { OsmElement, GeoLocation, TerrainGrid } from '../../types.js';
import { LAYERS, SLOPE_COLORS, SLOPE_THRESHOLDS } from '../../constants.js';

// --- Re-implementing helper functions locally for the backend context ---

const project = (lat: number, lon: number, center: GeoLocation) => {
  const R = 6378137;
  const dLat = (lat - center.lat) * (Math.PI / 180);
  const dLon = (lon - center.lng) * (Math.PI / 180);
  const latRad = center.lat * (Math.PI / 180);

  const x = R * dLon * Math.cos(latRad);
  const y = R * dLat;
  return { x, y };
};

const perpendicularDistance = (p: { x: number, y: number }, v: { x: number, y: number }, w: { x: number, y: number }) => {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  const tClamped = Math.max(0, Math.min(1, t));
  const projX = v.x + tClamped * (w.x - v.x);
  const projY = v.y + tClamped * (w.y - v.y);
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
};

const simplifyPoints = (points: { x: number, y: number }[], tolerance: number): { x: number, y: number }[] => {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, index + 1), tolerance);
    const right = simplifyPoints(points.slice(index), tolerance);
    return [...left.slice(0, left.length - 1), ...right];
  } else {
    return [points[0], points[end]];
  }
};

const dxfHeader = () => `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n`;
const dxfEnd = () => `0\nEOF\n`;
const dxfTables = () => {
  let s = `0\nSECTION\n2\nTABLES\n`;
  s += `0\nTABLE\n2\nLTYPE\n70\n1\n`;
  s += `0\nLTYPE\n2\nDASHED\n70\n0\n3\nDashed __ __ __ __\n72\n65\n73\n2\n40\n2.0\n49\n1.25\n74\n0\n49\n-0.75\n74\n0\n`;
  s += `0\nENDTAB\n`;
  s += `0\nTABLE\n2\nLAYER\n70\n${Object.keys(LAYERS).length}\n`;
  Object.values(LAYERS).forEach(l => {
    s += `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n0\n`;
  });
  s += `0\nENDTAB\n0\nENDSEC\n`;
  return s;
};

const getHeight = (tags: Record<string, string> | undefined): number => {
  if (!tags) return 0;
  if (tags.height) {
    const h = parseFloat(tags.height.replace(/[^\d.]/g, ''));
    if (!isNaN(h)) return h;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!isNaN(levels)) return Math.max(levels * 3.2, 3);
  }
  if (tags.building) {
    switch (tags.building) {
      case 'apartments': return 15;
      case 'house': return 6;
      case 'retail': return 6;
      case 'office': return 14;
      case 'industrial': return 9;
      case 'church': return 18;
      case 'hospital': return 20;
      case 'skyscraper': return 80;
      default: return 6;
    }
  }
  if (tags.barrier) return ['wall', 'fence'].includes(tags.barrier) ? 2.5 : 1;
  if (tags.man_made === 'chimney') return 30;
  if (tags.power === 'pole') return 8;
  if (tags.natural === 'tree') return 6;
  return 0;
};

const getLayerOffset = (tags: Record<string, string> | undefined): number => {
  if (!tags) return 0;
  let layerVal = 0;
  if (tags.layer) {
    const l = parseFloat(tags.layer);
    if (!isNaN(l)) layerVal = l;
  } else {
    if (tags.bridge === 'yes' || tags.bridge === 'viaduct' || tags.man_made === 'bridge') layerVal = 1;
    if (tags.tunnel === 'yes' || tags.tunnel === 'building_passage') layerVal = -1;
  }
  return layerVal * 5;
};

const getLayer = (tags: Record<string, string> | undefined) => {
  if (!tags) return LAYERS.DEFAULT.name;
  if (tags.building) return LAYERS.BUILDINGS.name;
  if (tags.bridge === 'yes' || tags.bridge === 'viaduct') return LAYERS.BRIDGES.name;
  if (tags.tunnel === 'yes') return LAYERS.TUNNELS.name;
  if (tags.highway === 'traffic_signals') return LAYERS.SIGNALS.name;
  if (['bench', 'waste_basket', 'post_box'].includes(tags.amenity || '')) return LAYERS.FURNITURE.name;

  if (tags.highway) {
    const h = tags.highway;
    if (['motorway', 'trunk', 'motorway_link'].includes(h)) return LAYERS.ROADS_HIGHWAY.name;
    if (['primary', 'secondary'].includes(h)) return LAYERS.ROADS_MAJOR.name;
    if (['tertiary', 'residential', 'unclassified'].includes(h)) return LAYERS.ROADS_MINOR.name;
    if (['service', 'escape'].includes(h)) return LAYERS.ROADS_SERVICE.name;
    if (h === 'cycleway' || tags.bicycle === 'designated') return LAYERS.ROADS_CYCLEWAY.name;
    if (['footway', 'pedestrian', 'steps'].includes(h) || tags.foot === 'designated') return LAYERS.ROADS_FOOTWAY.name;
    return LAYERS.ROADS_OTHER.name;
  }

  if (tags.natural || tags.landuse === 'grass') return LAYERS.NATURE.name;
  if (tags.waterway || tags.natural === 'water') return LAYERS.WATER.name;
  if (tags.amenity || tags.man_made) return LAYERS.DETAILS.name;
  return LAYERS.DEFAULT.name;
};

const getElevationAt = (lat: number, lng: number, terrain: TerrainGrid | undefined, centerElev: number): number => {
  if (!terrain || terrain.length === 0) return 0;
  let closestDist = Infinity;
  let elev = 0;
  for (let i = 0; i < terrain.length; i++) {
    for (let j = 0; j < terrain[i].length; j++) {
      const p = terrain[i][j];
      const d = Math.pow(p.lat - lat, 2) + Math.pow(p.lng - lng, 2);
      if (d < closestDist) {
        closestDist = d;
        elev = p.elevation;
      }
    }
  }
  return elev - centerElev;
};

const calculateSlope = (p1: any, p2: any, p3: any): number => {
  const ux = p2.x - p1.x;
  const uy = p2.y - p1.y;
  const uz = p2.z - p1.z;
  const vx = p3.x - p1.x;
  const vy = p3.y - p1.y;
  const vz = p3.z - p1.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const magN = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (magN === 0) return 0;
  const dot = Math.abs(nz);
  return Math.acos(dot / magN) * (180 / Math.PI);
};

const getSlopeColor = (angle: number): number => {
  if (angle <= SLOPE_THRESHOLDS.FLAT) return SLOPE_COLORS.FLAT;
  if (angle <= SLOPE_THRESHOLDS.MILD) return SLOPE_COLORS.MILD;
  if (angle <= SLOPE_THRESHOLDS.MODERATE) return SLOPE_COLORS.MODERATE;
  return SLOPE_COLORS.STEEP;
};

const generatePolyline = (points: any[], layer: string, isClosed: boolean, height: number, center: GeoLocation, centerElev: number, terrain?: TerrainGrid, layerOffset: number = 0, linetype: string = 'CONTINUOUS', simplify: boolean = false) => {
  let projected = points.map(p => project(p.lat, p.lon, center));
  if (simplify && projected.length > 2) projected = simplifyPoints(projected, 0.8);

  let body = '';
  const flag = isClosed ? 1 : 0;
  const firstPt = points[0];
  const zBase = getElevationAt(firstPt.lat, firstPt.lon, terrain, centerElev) + layerOffset;

  body += `0\nLWPOLYLINE\n8\n${layer}\n6\n${linetype}\n90\n${projected.length}\n70\n${flag}\n38\n${zBase.toFixed(2)}\n39\n${height}\n`;
  projected.forEach(pt => {
    body += `10\n${pt.x.toFixed(4)}\n20\n${pt.y.toFixed(4)}\n`;
  });
  return body;
};

// --- Exported Backend Function ---

export const generateDXF = (
  elements: OsmElement[],
  center: GeoLocation,
  terrain?: TerrainGrid,
  options: { simplify: boolean } = { simplify: false }
): string => {
  let centerElev = 0;
  if (terrain && terrain.length > 0) {
    const mid = Math.floor(terrain.length / 2);
    centerElev = terrain[mid][mid].elevation;
  }

  const metaInfo = [
    "999", "DXF Generated by Smart Backend",
    "999", "System: Node.js + Express",
    "999", `Origin: Lat ${center.lat}, Lng ${center.lng}`,
    "999", `Simplify: ${options.simplify}`,
    ""
  ].join("\n");

  let body = `0\nSECTION\n2\nENTITIES\n`;

  // Terrain Mesh
  if (terrain && terrain.length > 1) {
    for (let i = 0; i < terrain.length - 1; i++) {
      for (let j = 0; j < terrain[i].length - 1; j++) {
        const p1 = terrain[i][j];
        const p2 = terrain[i + 1][j];
        const p3 = terrain[i + 1][j + 1];
        const p4 = terrain[i][j + 1];

        const v1 = project(p1.lat, p1.lng, center);
        const v2 = project(p2.lat, p2.lng, center);
        const v3 = project(p3.lat, p3.lng, center);
        const v4 = project(p4.lat, p4.lng, center);

        const z1 = p1.elevation - centerElev;
        const z2 = p2.elevation - centerElev;
        const z3 = p3.elevation - centerElev;
        const z4 = p4.elevation - centerElev;

        const t1_slope = calculateSlope({ x: v1.x, y: v1.y, z: z1 }, { x: v2.x, y: v2.y, z: z2 }, { x: v4.x, y: v4.y, z: z4 });
        const t2_slope = calculateSlope({ x: v2.x, y: v2.y, z: z2 }, { x: v3.x, y: v3.y, z: z3 }, { x: v4.x, y: v4.y, z: z4 });

        body += `0\n3DFACE\n8\n${LAYERS.TERRAIN.name}\n62\n${getSlopeColor(t1_slope)}\n`;
        body += `10\n${v1.x.toFixed(2)}\n20\n${v1.y.toFixed(2)}\n30\n${z1.toFixed(2)}\n`;
        body += `11\n${v2.x.toFixed(2)}\n21\n${v2.y.toFixed(2)}\n31\n${z2.toFixed(2)}\n`;
        body += `12\n${v4.x.toFixed(2)}\n22\n${v4.y.toFixed(2)}\n32\n${z4.toFixed(2)}\n`;
        body += `13\n${v4.x.toFixed(2)}\n23\n${v4.y.toFixed(2)}\n33\n${z4.toFixed(2)}\n`;

        body += `0\n3DFACE\n8\n${LAYERS.TERRAIN.name}\n62\n${getSlopeColor(t2_slope)}\n`;
        body += `10\n${v2.x.toFixed(2)}\n20\n${v2.y.toFixed(2)}\n30\n${z2.toFixed(2)}\n`;
        body += `11\n${v3.x.toFixed(2)}\n21\n${v3.y.toFixed(2)}\n31\n${z3.toFixed(2)}\n`;
        body += `12\n${v4.x.toFixed(2)}\n22\n${v4.y.toFixed(2)}\n32\n${z4.toFixed(2)}\n`;
        body += `13\n${v4.x.toFixed(2)}\n23\n${v4.y.toFixed(2)}\n33\n${z4.toFixed(2)}\n`;
      }
    }
  }

  // OSM Elements
  elements.forEach(el => {
    if (el.type === 'way' && el.geometry) {
      const isBuilding = !!el.tags?.building;
      let layer = getLayer(el.tags);
      const height = getHeight(el.tags);
      const layerOffset = getLayerOffset(el.tags);
      const isTunnel = el.tags?.tunnel === 'yes' || el.tags?.tunnel === 'building_passage';
      const linetype = isTunnel ? 'DASHED' : 'CONTINUOUS';
      let isClosed = isBuilding;
      if (!isClosed && el.nodes && el.nodes.length > 0) isClosed = el.nodes[0] === el.nodes[el.nodes.length - 1];

      body += generatePolyline(el.geometry, layer, isClosed, height, center, centerElev, terrain, layerOffset, linetype, options.simplify);
    }
    else if (el.type === 'relation' && el.tags?.building) {
      const height = getHeight(el.tags);
      const layerOffset = getLayerOffset(el.tags);
      el.members.forEach((member: any) => {
        if (member.type === 'way' && member.role === 'outer' && member.geometry) {
          body += generatePolyline(member.geometry, LAYERS.BUILDINGS.name, true, height, center, centerElev, terrain, layerOffset, 'CONTINUOUS', options.simplify);
        }
      });
    }
    else if (el.type === 'node' && el.tags) {
      let radius = 0.5;
      let isInteresting = false;
      const t = el.tags;
      if (t.natural === 'tree') { isInteresting = true; radius = 1.5; }
      else if (t.highway === 'street_lamp') { isInteresting = true; radius = 0.2; }

      if (isInteresting) {
        const { x, y } = project(el.lat, el.lon, center);
        const height = getHeight(el.tags);
        const layer = getLayer(el.tags);
        const zBase = getElevationAt(el.lat, el.lon, terrain, centerElev);
        body += `0\nCIRCLE\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n${zBase.toFixed(2)}\n40\n${radius}\n`;
        if (height > 0) body += `39\n${height}\n`;
      }
    }
  });

  body += `0\nENDSEC\n`;
  return `${metaInfo}${dxfHeader()}${dxfTables()}${body}${dxfEnd()}`;
};