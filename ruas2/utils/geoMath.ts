

import { GeoLocation, TerrainPoint } from '../types';

/**
 * Calculates simplified sun position.
 * Returns azimuth and altitude in radians.
 * @param lat Latitude
 * @param hour Hour of day (0-24)
 */
export const calculateSunPosition = (lat: number, hour: number) => {
  // Simplified solar physics for UI visualization
  // A real implementation (like SunCalc) is more complex, but this suffices for a preview.
  
  const latRad = (lat * Math.PI) / 180;
  // Assume Equinox for generic shadow length (neutral)
  const declination = 0; 
  
  // Hour angle (0 at noon)
  const h = (hour - 12) * 15 * (Math.PI / 180);
  
  // Altitude
  const sinAlt = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(h);
  const alt = Math.asin(sinAlt);
  
  // Azimuth
  const cosAz = (Math.sin(declination) * Math.cos(latRad) - Math.cos(declination) * Math.sin(latRad) * Math.cos(h)) / Math.cos(alt);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  
  if (hour > 12) az = 2 * Math.PI - az;
  
  return {
    altitude: alt,
    azimuth: az
  };
};

export const calculateShadowOffset = (height: number, sunPos: { altitude: number, azimuth: number }, pixelScale: number) => {
  if (sunPos.altitude <= 0) return { x: 0, y: 0 }; // Night
  
  // Shadow length factor based on altitude
  const length = height / Math.tan(Math.max(0.1, sunPos.altitude));
  
  // Leaflet coordinates: Y is inverted relative to standard cartesian for north
  // Azimuth 0 is South in some formulas, North in others. 
  // Here we assume standard map: North is Up.
  // Shadow is cast OPPOSITE to sun.
  
  const shadowAzimuth = sunPos.azimuth + Math.PI; // Opposite direction
  
  const dx = Math.sin(shadowAzimuth) * length * pixelScale; 
  const dy = Math.cos(shadowAzimuth) * length * pixelScale; // Latitude correction ignored for visual preview simplicity
  
  return { x: dx, y: -dy }; // -dy because screen Y goes down
};

/**
 * Samples elevation points along a line between two coordinates
 */
export const generateElevationProfile = (start: GeoLocation, end: GeoLocation, terrainData: TerrainPoint[][]): { dist: number, elev: number }[] => {
    if (!terrainData || terrainData.length === 0) return [];

    const profile = [];
    const steps = 20;
    
    // Flatten grid for searching (naive nearest neighbor for this prototype)
    const points = terrainData.flat();
    
    // Distance between start/end
    const R = 6371e3;
    const φ1 = start.lat * Math.PI/180;
    const φ2 = end.lat * Math.PI/180;
    const Δφ = (end.lat-start.lat) * Math.PI/180;
    const Δλ = (end.lng-start.lng) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const totalDist = R * c;

    for(let i=0; i<=steps; i++) {
        const t = i/steps;
        const curLat = start.lat + (end.lat - start.lat) * t;
        const curLng = start.lng + (end.lng - start.lng) * t;
        
        // Find nearest point in grid
        let minD = Infinity;
        let closestElev = 0;
        
        // Optimization: In a real app, use a QuadTree or proper Grid Indexing. 
        // For < 200 points in terrainData, simple loop is fine.
        for(const p of points) {
            const d = Math.abs(p.lat - curLat) + Math.abs(p.lng - curLng);
            if(d < minD) {
                minD = d;
                closestElev = p.elevation;
            }
        }
        
        profile.push({
            dist: parseFloat((totalDist * t).toFixed(1)),
            elev: closestElev
        });
    }
    
    return profile;
};

/**
 * Converts UTM coordinates to Latitude/Longitude (WGS84)
 * @param zone UTM Zone (1-60)
 * @param hemisphere 'N' for North, 'S' for South
 * @param easting Easting (meters)
 * @param northing Northing (meters)
 */
export const utmToLatLon = (zone: number, hemisphere: 'N' | 'S', easting: number, northing: number): { lat: number, lng: number } | null => {
    if (!zone || !easting || !northing) return null;

    const a = 6378137;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e = Math.sqrt(f * (2 - f));
    
    const x = easting - 500000;
    const y = hemisphere === 'S' ? northing - 10000000 : northing;
    
    const m = y / k0;
    const mu = m / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));
    
    const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));
    
    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    const J4 = (1097 * Math.pow(e1, 4) / 512);
    
    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);
    
    const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
    const c1 = e2 * Math.pow(Math.cos(fp), 2);
    const t1 = Math.pow(Math.tan(fp), 2);
    const r1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
    const n1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
    const d = x / (n1 * k0);
    
    const latRad = fp - (n1 * Math.tan(fp) / r1) * (Math.pow(d, 2) / 2 - (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4) / 24 + (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * e2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720);
    const lngRad = (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 + (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * e2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120) / Math.cos(fp);
    
    const zoneCentralMeridian = (zone - 1) * 6 - 180 + 3;
    const lng = (lngRad * 180 / Math.PI) + zoneCentralMeridian;
    const lat = latRad * 180 / Math.PI;

    return { lat, lng };
};
