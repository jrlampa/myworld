
export const LAYERS = {
  BUILDINGS: { name: 'BUILDINGS', color: 2 },
  BLD_RESIDENTIAL: { name: 'BLD_RESIDENTIAL', color: 2 },
  BLD_COMMERCIAL: { name: 'BLD_COMMERCIAL', color: 4 },
  BLD_INDUSTRIAL: { name: 'BLD_INDUSTRIAL', color: 6 },
  BLD_INSTITUTIONAL: { name: 'BLD_INSTITUTIONAL', color: 3 },
  BLD_GENERIC: { name: 'BLD_GENERIC', color: 2 },
  
  ROADS_CENTER: { name: 'ROADS_CENTER', color: 1 },
  ROADS_CURBS: { name: 'ROADS_CURBS', color: 8 },
  ROADS_MAJOR: { name: 'ROADS_MAJOR', color: 1 },
  ROADS_MINOR: { name: 'ROADS_MINOR', color: 7 },
  ROADS_SERVICE: { name: 'ROADS_SERVICE', color: 252 },
  
  SIGNALS: { name: 'SIGNALS', color: 1 },
  FURNITURE: { name: 'FURNITURE', color: 34 },
  
  INFRA_WATER: { name: 'INFRA_WATER', color: 5 },
  INFRA_SEWER: { name: 'INFRA_SEWER', color: 30 },
  
  // Electrical Distribution Pro
  INFRA_POWER_MT: { name: 'INFRA_POWER_MT', color: 10 },
  INFRA_POWER_BT: { name: 'INFRA_POWER_BT', color: 50 },
  INFRA_POWER_SERVICE: { name: 'INFRA_POWER_SERVICE', color: 31 }, // Orange-ish for drops
  INFRA_POWER_POLES: { name: 'INFRA_POWER_POLES', color: 7 },
  INFRA_POWER_GUY: { name: 'INFRA_POWER_GUY', color: 8 }, // Grey for guy wires
  INFRA_POWER_LIGHT: { name: 'INFRA_POWER_LIGHT', color: 2 }, // Yellow for illumination
  
  NATURE: { name: 'NATURE', color: 3 },
  TERRAIN: { name: 'TERRAIN', color: 9 },
  CONTOURS: { name: 'CONTOURS', color: 8 },
  ANALYSIS_SLOPE: { name: 'ANALYSIS_SLOPE', color: 1 },
  
  LABELS: { name: 'LABELS', color: 7 },
  DIMENSIONS: { name: 'DIMENSIONS', color: 140 },
  GRID: { name: 'GRID', color: 251 },
  DEFAULT: { name: '0', color: 7 }
};

export const HATCH_PATTERNS = {
  RESIDENTIAL: { name: 'ANSI31', scale: 0.5, angle: 0 },
  COMMERCIAL: { name: 'ANSI37', scale: 0.5, angle: 0 },
  INDUSTRIAL: { name: 'ANSI32', scale: 0.5, angle: 0 },
  INSTITUTIONAL: { name: 'ANSI34', scale: 0.5, angle: 0 },
  GENERIC: { name: 'SOLID', scale: 1.0, angle: 0 }
};

export const SLOPE_THRESHOLDS = {
  MODERATE: 30
};

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

export const TOLERANCE_MAP = {
  off: 0,
  low: 0.5,
  medium: 1.5,
  high: 4.0
};
