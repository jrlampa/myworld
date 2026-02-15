export const DEFAULT_LOCATION = {
  lat: -23.5505, // São Paulo, generic start
  lng: -46.6333,
  label: "São Paulo, Brazil"
};

export const MIN_RADIUS = 10;
export const MAX_RADIUS = 2000;

export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

// Layer Colors for DXF (AutoCAD Color Index)
export const LAYERS = {
  BUILDINGS: { name: 'BUILDINGS', color: 2 }, // Yellow
  
  // Road Hierarchy
  ROADS_HIGHWAY: { name: 'ROADS_HIGHWAY', color: 1 }, // Red (Motorways)
  ROADS_MAJOR: { name: 'ROADS_MAJOR', color: 6 }, // Magenta (Primary/Secondary)
  ROADS_MINOR: { name: 'ROADS_MINOR', color: 30 }, // Orange (Residential/Tertiary)
  ROADS_SERVICE: { name: 'ROADS_SERVICE', color: 252 }, // Gray (Service/Alley)
  ROADS_CYCLEWAY: { name: 'ROADS_CYCLEWAY', color: 130 }, // Cyan-ish (Bike paths)
  ROADS_FOOTWAY: { name: 'ROADS_FOOTWAY', color: 9 }, // Light Gray (Pedestrian)
  ROADS_OTHER: { name: 'ROADS_OTHER', color: 7 }, // White (Others/Paths)

  // Structures
  BRIDGES: { name: 'BRIDGES', color: 4 }, // Cyan
  TUNNELS: { name: 'TUNNELS', color: 8 }, // Dark Grey (often hidden)

  // Street Furniture
  FURNITURE: { name: 'FURNITURE', color: 34 }, // Brownish/Orange
  SIGNALS: { name: 'SIGNALS', color: 1 }, // Red

  NATURE: { name: 'NATURE', color: 3 }, // Green
  WATER: { name: 'WATER', color: 5 }, // Blue
  DETAILS: { name: 'DETAILS', color: 4 }, // Cyan
  TERRAIN: { name: 'TERRAIN', color: 252 }, // Gray default, overridden by slope colors
  DEFAULT: { name: '0', color: 7 } // White
};

export const SLOPE_THRESHOLDS = {
  FLAT: 5,     // 0-5 degrees
  MILD: 15,    // 5-15 degrees
  MODERATE: 30 // 15-30 degrees, >30 is Steep
};

export const SLOPE_COLORS = {
  FLAT: 112,    // Light Green
  MILD: 2,      // Yellow
  MODERATE: 30, // Orange
  STEEP: 1      // Red
};
