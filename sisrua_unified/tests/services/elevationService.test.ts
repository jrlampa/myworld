import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchElevationGrid } from '../../src/services/elevationService';
import Logger from '../../src/utils/logger';

describe('fetchElevationGrid', () => {
  const center = { lat: -21.37, lng: -42.22 };
  const radius = 100;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('clamps grid size to avoid oversized Open-Meteo requests', async () => {
    const elevationCount = 81; // 9x9 grid after clamping
    const mockJson = { elevation: Array(elevationCount).fill(10) };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    await fetchElevationGrid(center, radius, 12);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = (global.fetch as any).mock.calls[0][0] as string;
    const params = new URL(url).searchParams;
    const lats = params.get('latitude')?.split(',') ?? [];
    const lngs = params.get('longitude')?.split(',') ?? [];

    expect(lats.length).toBe(elevationCount);
    expect(lngs.length).toBe(elevationCount);
    expect(Logger.warn).toHaveBeenCalled();
  });
});
