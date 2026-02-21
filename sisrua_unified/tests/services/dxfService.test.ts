import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDXF, getDxfJobStatus, calculateStats } from '../../src/services/dxfService';
import { OsmElement } from '../../src/types';

global.fetch = vi.fn();

describe('dxfService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- generateDXF ---

  it('generateDXF: returns queued response with jobId', async () => {
    const queued = { status: 'queued', jobId: 'abc-123' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => queued
    });

    const result = await generateDXF(-22.15018, -42.92185, 500, 'circle', [], {}, 'utm');
    expect(result).toEqual(queued);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dxf'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('generateDXF: returns cached success response with url', async () => {
    const cached = { status: 'success', url: '/downloads/result.dxf' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => cached
    });

    const result = await generateDXF(-22.15018, -42.92185, 100, 'circle', [], {});
    expect(result).toEqual(cached);
  });

  it('generateDXF: throws on non-ok response with error details', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ details: 'Validation error' })
    });

    await expect(generateDXF(-22.15018, -42.92185, 500, 'circle', [], {}))
      .rejects.toThrow('Validation error');
  });

  it('generateDXF: throws on non-ok response with generic message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    await expect(generateDXF(-22.15018, -42.92185, 500, 'circle', [], {}))
      .rejects.toThrow('Backend generation failed');
  });

  // --- getDxfJobStatus ---

  it('getDxfJobStatus: returns job status object', async () => {
    const status = { id: 'abc-123', status: 'processing', progress: 50, result: null, error: null };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => status
    });

    const result = await getDxfJobStatus('abc-123');
    expect(result).toEqual(status);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/jobs/abc-123'));
  });

  it('getDxfJobStatus: throws on non-ok with details field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ details: 'Job not found' })
    });

    await expect(getDxfJobStatus('missing')).rejects.toThrow('Job not found');
  });

  it('getDxfJobStatus: throws on non-ok with error field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Internal error' })
    });

    await expect(getDxfJobStatus('err')).rejects.toThrow('Internal error');
  });

  it('getDxfJobStatus: throws fallback message when no detail fields', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    await expect(getDxfJobStatus('x')).rejects.toThrow('Failed to load job status');
  });

  // --- calculateStats ---

  it('calculateStats: counts buildings, roads, nature from OSM elements', () => {
    const elements: OsmElement[] = [
      { type: 'way', id: 1, nodes: [], tags: { building: 'yes' } },
      { type: 'way', id: 2, nodes: [], tags: { highway: 'residential' } },
      { type: 'way', id: 3, nodes: [], tags: { natural: 'wood' } },
      { type: 'node', id: 4, lat: 0, lon: 0, tags: { landuse: 'forest' } }
    ];

    const stats = calculateStats(elements);
    expect(stats.totalBuildings).toBe(1);
    expect(stats.totalRoads).toBe(1);
    expect(stats.totalNature).toBe(2);
    expect(stats.avgHeight).toBe(0);
    expect(stats.maxHeight).toBe(0);
  });

  it('calculateStats: extracts height from height tag', () => {
    const elements: OsmElement[] = [
      { type: 'way', id: 1, nodes: [], tags: { building: 'yes', height: '10' } },
      { type: 'way', id: 2, nodes: [], tags: { building: 'yes', height: '20' } }
    ];

    const stats = calculateStats(elements);
    expect(stats.avgHeight).toBe(15);
    expect(stats.maxHeight).toBe(20);
  });

  it('calculateStats: extracts height from building:levels tag', () => {
    const elements: OsmElement[] = [
      { type: 'way', id: 1, nodes: [], tags: { building: 'yes', 'building:levels': '3' } }
    ];

    const stats = calculateStats(elements);
    expect(stats.avgHeight).toBeCloseTo(3 * 3.2);
    expect(stats.maxHeight).toBeCloseTo(3 * 3.2);
  });

  it('calculateStats: returns zero counts for empty array', () => {
    const stats = calculateStats([]);
    expect(stats.totalBuildings).toBe(0);
    expect(stats.totalRoads).toBe(0);
    expect(stats.totalNature).toBe(0);
    expect(stats.avgHeight).toBe(0);
    expect(stats.maxHeight).toBe(0);
  });
});
