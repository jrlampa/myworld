import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchElevationGrid, fetchElevationProfile } from '../../src/services/elevationService';
import Logger from '../../src/utils/logger';

describe('fetchElevationGrid', () => {
  const center = { lat: -22.15018, lng: -42.92185 };  // Canonical test coordinates (Muriaé/MG)
  const radius = 100;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger, 'error').mockImplementation(() => {});
    vi.spyOn(Logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'debug').mockImplementation(() => {});
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

  it('returns flat grid (elevation=0) when API throws (lines 76-91)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Rede indisponível')) as any;

    const grid = await fetchElevationGrid(center, radius, 3);

    // Grid plana: todos os pontos com elevation=0
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(3);
    expect(grid[0][0].elevation).toBe(0);
    expect(Logger.error).toHaveBeenCalled();
  });

  it('returns flat grid when response is not ok (lines 76-91)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({})
    }) as any;

    const grid = await fetchElevationGrid(center, radius, 3);

    expect(grid.length).toBe(3);
    expect(grid[0][0].elevation).toBe(0);
    expect(Logger.error).toHaveBeenCalled();
  });

  it('returns flat grid when elevation data length is invalid', async () => {
    // API retorna lista com tamanho errado
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elevation: [10, 20] })  // tamanho errado
    }) as any;

    const grid = await fetchElevationGrid(center, radius, 3);

    expect(grid.length).toBe(3);
    expect(grid[0][0].elevation).toBe(0);
    expect(Logger.error).toHaveBeenCalled();
  });

  it('returns valid grid without warning when gridSize <= MAX_GRID_SIZE', async () => {
    const gridSize = 3;
    const elevationCount = gridSize * gridSize;
    const mockJson = { elevation: Array(elevationCount).fill(100) };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    const grid = await fetchElevationGrid(center, radius, gridSize);

    expect(grid.length).toBe(gridSize);
    expect(grid[0].length).toBe(gridSize);
    expect(grid[1][1].elevation).toBe(100);
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  it('uses default gridSize of 12 when not specified (clamped to 9)', async () => {
    const elevationCount = 81; // 9x9
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elevation: Array(elevationCount).fill(5) })
    }) as any;

    const grid = await fetchElevationGrid(center, radius);

    expect(grid.length).toBe(9);
    expect(Logger.warn).toHaveBeenCalled();
  });

  it('returned grid contains correct lat/lng coordinates near canonical test coords', async () => {
    const gridSize = 2;
    const mockJson = { elevation: Array(gridSize * gridSize).fill(50) };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    const grid = await fetchElevationGrid(center, radius, gridSize);

    // Verifica que as coordenadas estão na vizinhança das canônicas
    const point = grid[0][0];
    expect(point.lat).toBeCloseTo(center.lat, 0);
    expect(point.lng).toBeCloseTo(center.lng, 0);
  });

  it('preserves elevation=0 values (covers "elevations[idx] || 0" right branch)', async () => {
    const gridSize = 2;
    // Mix of non-zero and zero elevations — zero triggers the right-side of `|| 0`
    const mockJson = { elevation: [100, 0, 50, 0] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson)
    }) as any;

    const grid = await fetchElevationGrid(center, radius, gridSize);

    expect(grid[0][0].elevation).toBe(100);
    expect(grid[0][1].elevation).toBe(0); // 0 || 0 → right branch evaluated
    expect(grid[1][0].elevation).toBe(50);
    expect(grid[1][1].elevation).toBe(0); // 0 || 0 → right branch evaluated
  });
});

describe('fetchElevationProfile', () => {
  const originalFetch = global.fetch;
  const start = { lat: -22.15018, lng: -42.92185 };
  const end = { lat: -22.16, lng: -42.93 };

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns elevation profile when API responds successfully', async () => {
    const mockProfile = [{ lat: -22.15, lng: -42.92, elevation: 200 }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: mockProfile })
    }) as any;

    const profile = await fetchElevationProfile(start, end);

    expect(profile).toEqual(mockProfile);
  });

  it('returns empty array when API throws network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const profile = await fetchElevationProfile(start, end);

    expect(profile).toEqual([]);
  });

  it('returns empty array when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({})
    }) as any;

    const profile = await fetchElevationProfile(start, end);

    expect(profile).toEqual([]);
  });
});

