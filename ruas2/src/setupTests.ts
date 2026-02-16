import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver (Used by Recharts)
// Using globalThis to avoid "Cannot find name 'global'" if Node types aren't loaded
// @ts-ignore
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Leaflet (Browser API dependency)
// This prevents "window is not defined" or canvas errors in JSDOM
vi.mock('leaflet', () => ({
  map: () => ({
    setView: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getCenter: vi.fn().mockReturnValue({ distanceTo: () => 0 }),
    getZoom: vi.fn().mockReturnValue(15),
    flyTo: vi.fn(),
  }),
  tileLayer: () => ({
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    bringToBack: vi.fn(),
  }),
  circle: () => ({
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }),
  polygon: () => ({
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }),
  circleMarker: () => ({
    addTo: vi.fn().mockReturnThis(),
  }),
  layerGroup: () => ({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  }),
  rectangle: () => ({
    addTo: vi.fn().mockReturnThis(),
  }),
}));