import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCATION, MIN_RADIUS, MAX_RADIUS, TEST_COORDS } from '../src/constants';

describe('Constants', () => {
  describe('DEFAULT_LOCATION', () => {
    it('should have valid coordinates', () => {
      expect(DEFAULT_LOCATION.lat).toBeTypeOf('number');
      expect(DEFAULT_LOCATION.lng).toBeTypeOf('number');
      expect(DEFAULT_LOCATION.label).toBeTypeOf('string');
    });

    it('should be São Paulo coordinates', () => {
      expect(DEFAULT_LOCATION.lat).toBeCloseTo(-23.5505, 2);
      expect(DEFAULT_LOCATION.lng).toBeCloseTo(-46.6333, 2);
    });
  });

  describe('Radius limits', () => {
    it('should have valid min radius', () => {
      expect(MIN_RADIUS).toBeGreaterThan(0);
      expect(MIN_RADIUS).toBe(10);
    });

    it('should have valid max radius', () => {
      expect(MAX_RADIUS).toBeGreaterThan(MIN_RADIUS);
      expect(MAX_RADIUS).toBe(2000);
    });
  });

  describe('TEST_COORDS (coordenadas canônicas de teste)', () => {
    it('deve ter coordenadas válidas para Muriaé/MG', () => {
      expect(TEST_COORDS.lat).toBeCloseTo(-22.15018, 4);
      expect(TEST_COORDS.lng).toBeCloseTo(-42.92185, 4);
    });

    it('deve ter zona UTM 23K', () => {
      expect(TEST_COORDS.utmZone).toBe('23K');
      expect(TEST_COORDS.utmE).toBe(788547);
      expect(TEST_COORDS.utmN).toBe(7634925);
    });

    it('deve ter raios de teste: 100m, 500m e 1000m', () => {
      expect(TEST_COORDS.radii).toContain(100);
      expect(TEST_COORDS.radii).toContain(500);
      expect(TEST_COORDS.radii).toContain(1000);
    });

    it('deve ter rótulo em pt-BR', () => {
      expect(TEST_COORDS.label).toBeTypeOf('string');
      expect(TEST_COORDS.label.length).toBeGreaterThan(0);
    });
  });
});
