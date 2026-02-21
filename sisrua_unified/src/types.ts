export interface GeoLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmMember {
  type: string;
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmRelation {
  type: 'relation';
  id: number;
  members: OsmMember[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OsmElement[];
}

export interface DxfOptions {
  radius: number;
  center: GeoLocation;
  includeBuildings: boolean;
  includeRoads: boolean;
  includeNature: boolean;
  includeDetails: boolean; // street furniture, lights, etc
}

export interface AnalysisStats {
  totalBuildings: number;
  totalRoads: number;
  totalNature: number;
  avgHeight: number;
  maxHeight: number;
}

export interface TerrainPoint {
  lat: number;
  lng: number;
  elevation: number;
}

export type TerrainGrid = TerrainPoint[][];

export interface ProjectMetadata {
  projectName: string;
  companyName: string;
  engineerName: string;
  date: string;
  scale: string;
  revision: string;
}

export interface Violation {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  location: GeoLocation;
}

export interface LayerConfig {
  [key: string]: boolean;
  buildings: boolean;
  roads: boolean;
  curbs: boolean;
  nature: boolean;
  terrain: boolean;
  contours: boolean;
  slopeAnalysis: boolean;
  furniture: boolean;
  labels: boolean;
  dimensions: boolean;
  grid: boolean;
  power: boolean;
}

export type ProjectionType = 'local' | 'utm';
export type AppTheme = 'light' | 'dark';
export type MapProvider = 'vector' | 'satellite';
export type SimplificationLevel = 'off' | 'low' | 'medium' | 'high';

export interface AppSettings {
  enableAI: boolean;
  simplificationLevel: SimplificationLevel;
  orthogonalize: boolean;
  layers: LayerConfig;
  projection: ProjectionType;
  theme: AppTheme;
  mapProvider: MapProvider;
  projectMetadata: ProjectMetadata;
  contourInterval: number;
  /** Aplica normas ANEEL/PRODIST — substitui ABNT para infraestrutura elétrica */
  aneelProdist: boolean;
}

export type SelectionMode = 'circle' | 'polygon' | 'measure';

export interface GlobalState {
  center: GeoLocation;
  radius: number;
  selectionMode: SelectionMode;
  polygon: GeoLocation[];
  measurePath: GeoLocation[];
  settings: AppSettings;
}