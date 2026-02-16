
import { describe, it, expect } from 'vitest';
import { generateDXF } from '../services/dxfService';
import { OsmElement, GeoLocation, TerrainGrid } from '../../types';

// Mock specific internal functions if needed, but for "Robust A", 
// we want to test the output of the whole function given specific inputs.

const mockCenter: GeoLocation = { lat: 0, lng: 0, label: 'Null Island' };

const mockBuilding: OsmElement = {
  type: 'way',
  id: 1,
  nodes: [1, 2, 3, 4, 1],
  tags: { building: 'yes', height: '10' },
  geometry: [
    { lat: 0, lon: 0 },
    { lat: 0.001, lon: 0 },
    { lat: 0.001, lon: 0.001 },
    { lat: 0, lon: 0.001 },
    { lat: 0, lon: 0 } // Closed loop
  ]
};

const mockRoad: OsmElement = {
    type: 'way',
    id: 2,
    nodes: [5, 6],
    tags: { highway: 'primary' },
    geometry: [
        { lat: -0.001, lon: -0.001 },
        { lat: -0.002, lon: -0.002 }
    ]
};

describe('DXF Service Backend', () => {
  
  describe('DXF Structure Generation', () => {
    it('should generate a valid DXF header and footer', async () => {
      const dxf = await generateDXF([], mockCenter, undefined);
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('HEADER');
      expect(dxf).toContain('ENTITIES');
      expect(dxf).toContain('EOF');
    });

    it('should include Buildings layer when selected', async () => {
      const dxf = await generateDXF([mockBuilding], mockCenter, undefined, {
        simplificationLevel: 'off',
        layers: { buildings: true, roads: false, curbs: false, nature: false, terrain: false, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
        projection: 'local'
      });
      
      expect(dxf).toContain('LWPOLYLINE');
      expect(dxf).toContain('BUILDINGS'); // Layer Name
      expect(dxf).toContain('39'); // Height code
      expect(dxf).toContain('10'); // Height value check (depends on logic, but tag says 10)
    });

    it('should exclude Buildings when layer is disabled', async () => {
        const dxf = await generateDXF([mockBuilding], mockCenter, undefined, {
          simplificationLevel: 'off',
          layers: { buildings: false, roads: true, curbs: false, nature: false, terrain: false, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
          projection: 'local'
        });
        
        expect(dxf).not.toContain('BUILDINGS');
    });
  });

  describe('Simplification Logic (RDP)', () => {
    // Create a line with a tiny bump in the middle that should be simplified away
    const complexLine: OsmElement = {
        type: 'way',
        id: 3,
        nodes: [10, 11, 12],
        tags: { highway: 'residential' },
        geometry: [
            { lat: 0, lon: 0 },
            { lat: 0.000001, lon: 0.00005 }, // Tiny deviation
            { lat: 0, lon: 0.001 }
        ]
    };

    it('should reduce vertex count on high simplification', async () => {
        const dxf = await generateDXF([complexLine], mockCenter, undefined, {
            simplificationLevel: 'high', // Should trigger tolerance > 0
            layers: { buildings: false, roads: true, curbs: false, nature: false, terrain: false, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
            projection: 'local'
        });

        // Parse vertex count from LWPOLYLINE (Code 90)
        // This is a rough check, but effective. 
        // With High simplification, the middle point should likely go away or the coordinate precision changes.
        // A better check is verifying the output string length is smaller than 'off'
        
        const dxfOff = await generateDXF([complexLine], mockCenter, undefined, {
            simplificationLevel: 'off',
            layers: { buildings: false, roads: true, curbs: false, nature: false, terrain: false, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
            projection: 'local'
        });

        expect(dxf.length).toBeLessThan(dxfOff.length);
    });
  });

  describe('Projection Logic', () => {
      it('should handle UTM projection request', async () => {
          const dxf = await generateDXF([mockBuilding], mockCenter, undefined, {
              simplificationLevel: 'off',
              layers: { buildings: true, roads: false, curbs: false, nature: false, terrain: false, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
              projection: 'utm'
          });
          expect(dxf).toContain('UTM Zone');
      });
  });

  describe('Terrain Generation', () => {
      const mockTerrain: TerrainGrid = [
          [{ lat: 0, lng: 0, elevation: 10 }, { lat: 0, lng: 0.001, elevation: 10 }],
          [{ lat: 0.001, lng: 0, elevation: 20 }, { lat: 0.001, lng: 0.001, elevation: 30 }]
      ];

      it('should generate 3DFACE entities for terrain', async () => {
          const dxf = await generateDXF([], mockCenter, mockTerrain, {
              simplificationLevel: 'off',
              layers: { buildings: false, roads: false, curbs: false, nature: false, terrain: true, contours: false, slopeAnalysis: false, furniture: false, labels: false, dimensions: false, grid: false },
              projection: 'local'
          });
          expect(dxf).toContain('3DFACE');
          expect(dxf).toContain('TERRAIN');
      });
  });
});
