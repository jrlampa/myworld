import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOsmData } from '../../src/services/osmService';

global.fetch = vi.fn();

const OSM_ELEMENTS = [
  { type: 'node', id: 1, lat: -22.15018, lon: -42.92185, tags: { amenity: 'cafe' } }
];

describe('osmService - fetchOsmData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns elements on success from first endpoint', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: OSM_ELEMENTS })
    });

    const result = await fetchOsmData(-22.15018, -42.92185, 100);
    expect(result).toEqual(OSM_ELEMENTS);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to second endpoint if first fails with network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: OSM_ELEMENTS })
      });

    const result = await fetchOsmData(-22.15018, -42.92185, 500);
    expect(result).toEqual(OSM_ELEMENTS);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to second endpoint if first returns non-ok status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [] })
      });

    const result = await fetchOsmData(-22.15018, -42.92185, 1000);
    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when all endpoints fail', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));

    await expect(fetchOsmData(-22.15018, -42.92185, 100)).rejects.toThrow();
  });

  it('handles non-Error rejection (string) in inner catch — falls back to second endpoint', async () => {
    // Throwing a non-Error (string) covers the `String(error)` and `new Error(message)` branches
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce('ABORT_ERR')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: OSM_ELEMENTS })
      });

    const result = await fetchOsmData(-22.15018, -42.92185, 100);
    expect(result).toEqual(OSM_ELEMENTS);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
