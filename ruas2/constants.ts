

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
  // Base Layers
  BUILDINGS: { name: 'BUILDINGS', color: 2 }, // Yellow
  
  // Zoning Colors (New)
  BLD_RESIDENTIAL: { name: 'BLD_RESIDENTIAL', color: 2 }, // Yellow
  BLD_COMMERCIAL: { name: 'BLD_COMMERCIAL', color: 4 }, // Cyan
  BLD_INDUSTRIAL: { name: 'BLD_INDUSTRIAL', color: 6 }, // Magenta
  BLD_INSTITUTIONAL: { name: 'BLD_INSTITUTIONAL', color: 3 }, // Green
  BLD_GENERIC: { name: 'BLD_GENERIC', color: 2 }, // Yellow Default
  
  // Road Hierarchy
  ROADS_HIGHWAY: { name: 'ROADS_HIGHWAY', color: 1 }, // Red
  ROADS_MAJOR: { name: 'ROADS_MAJOR', color: 1 }, // Red
  ROADS_MINOR: { name: 'ROADS_MINOR', color: 7 }, // White
  ROADS_SERVICE: { name: 'ROADS_SERVICE', color: 252 }, // Gray
  ROADS_CURBS: { name: 'ROADS_CURBS', color: 8 }, // Dark Gray for curbs
  ROADS_CENTER: { name: 'ROADS_CENTER', color: 1 }, // Red Centerlines
  
  // Structures
  BRIDGES: { name: 'BRIDGES', color: 4 }, // Cyan
  TUNNELS: { name: 'TUNNELS', color: 8 }, // Dark Grey

  // Street Furniture
  FURNITURE: { name: 'FURNITURE', color: 34 }, // Brownish/Orange
  SIGNALS: { name: 'SIGNALS', color: 1 }, // Red

  NATURE: { name: 'NATURE', color: 3 }, // Green
  WATER: { name: 'WATER', color: 5 }, // Blue
  DETAILS: { name: 'DETAILS', color: 4 }, // Cyan
  TERRAIN: { name: 'TERRAIN', color: 9 }, // Light Gray
  CONTOURS: { name: 'CONTOURS', color: 8 }, // Dark Gray
  ANALYSIS_SLOPE: { name: 'ANALYSIS_SLOPE', color: 1 }, // Red for steep slopes
  
  LABELS: { name: 'LABELS', color: 7 }, // White
  DIMENSIONS: { name: 'DIMENSIONS', color: 140 }, // Light Blue
  GRID: { name: 'GRID', color: 251 }, // Very Light Gray
  DEFAULT: { name: '0', color: 7 } // White
};

export const HATCH_PATTERNS = {
  RESIDENTIAL: { name: 'ANSI31', scale: 0.5, angle: 0 },
  COMMERCIAL: { name: 'ANSI37', scale: 0.5, angle: 0 },
  INDUSTRIAL: { name: 'ANSI32', scale: 0.5, angle: 0 },
  INSTITUTIONAL: { name: 'ANSI34', scale: 0.5, angle: 0 },
  GENERIC: { name: 'SOLID', scale: 1.0, angle: 0 },
  NATURE: { name: 'GRASS', scale: 0.2, angle: 0 } // Often simplified to specific blocks instead
};

export const SLOPE_THRESHOLDS = {
  FLAT: 5,     // 0-5 degrees
  MILD: 15,    // 5-15 degrees
  MODERATE: 30 // 15-30 degrees
};

export const SLOPE_COLORS = {
  FLAT: 112,    // Light Green
  MILD: 2,      // Yellow
  MODERATE: 30, // Orange
  STEEP: 1      // Red
};

// Default widths in meters (total width)
export const ROAD_WIDTHS: Record<string, number> = {
  motorway: 20,
  trunk: 16,
  primary: 14,
  secondary: 12,
  tertiary: 10,
  residential: 8,
  service: 5,
  living_street: 6,
  pedestrian: 4,
  footway: 2,
  path: 2,
  cycleway: 2
};
