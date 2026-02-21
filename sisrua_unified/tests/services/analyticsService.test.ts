import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAnalyticsSummary } from '../../src/services/analyticsService';

global.fetch = vi.fn();

const MOCK_SUMMARY = {
  totalExports: 42,
  successfulExports: 40,
  failedExports: 2,
  successRate: 95.23,
  avgDurationMs: 3200,
  avgRadius: 500,
  batchExports: 5,
  singleExports: 37,
  exportsLast24h: 12,
  exportsLast7d: 42,
  exportsByHour: new Array(24).fill(0),
  topRegions: [],
  recentEvents: []
};

describe('analyticsService (frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchAnalyticsSummary: returns summary on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: MOCK_SUMMARY })
    });

    const result = await fetchAnalyticsSummary();
    expect(result).toEqual(MOCK_SUMMARY);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/analytics'));
  });

  it('fetchAnalyticsSummary: throws on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    await expect(fetchAnalyticsSummary()).rejects.toThrow('Erro ao buscar métricas: 500');
  });

  it('fetchAnalyticsSummary: propagates network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network fail'));

    await expect(fetchAnalyticsSummary()).rejects.toThrow('Network fail');
  });
});
