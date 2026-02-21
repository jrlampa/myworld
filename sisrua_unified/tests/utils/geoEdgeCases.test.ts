/**
 * Testes para geo.ts — casos extremos com proj4 mockado.
 *
 * Cobre linhas 34-35 de geo.ts:
 *   34: if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
 *   35: if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
 *
 * Coordenadas canônicas de entrada: UTM 23K 788547 7634925 (Muriaé/MG)
 */
import { describe, it, expect, vi } from 'vitest';

// Mock proj4 BEFORE importing geo.ts so the module sees the mock
vi.mock('proj4', () => ({
  default: vi.fn()
}));

import proj4 from 'proj4';
import { parseUtmQuery } from '../../src/utils/geo';

describe('parseUtmQuery — proj4 edge cases', () => {
  it('returns null when proj4 forward gives NaN lat (line 34 left branch)', () => {
    // proj4 returns [lng=valid, lat=NaN] → !isFinite(lat) → return null
    vi.mocked(proj4).mockReturnValue({ forward: () => [(-42.92), NaN] } as any);

    const result = parseUtmQuery('23K 788547 7634925');
    expect(result).toBeNull();
  });

  it('returns null when proj4 forward gives NaN lng (line 34 right branch)', () => {
    // proj4 returns [lng=NaN, lat=valid] → lat is finite, !isFinite(lng) → return null
    vi.mocked(proj4).mockReturnValue({ forward: () => [NaN, -22.15] } as any);

    const result = parseUtmQuery('23K 788547 7634925');
    expect(result).toBeNull();
  });

  it('returns null when proj4 forward gives out-of-range lng (line 35 right branch)', () => {
    // lat=45 (≤90), lng=200 (>180) → Math.abs(lat)>90 is false → checks lng → return null
    vi.mocked(proj4).mockReturnValue({ forward: () => [200, 45] } as any);

    const result = parseUtmQuery('23K 788547 7634925');
    expect(result).toBeNull();
  });
});
