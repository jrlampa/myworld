import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCATION, MIN_RADIUS, MAX_RADIUS } from '../src/constants';

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
});
