import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findLocationWithGemini, analyzeArea } from '../../src/services/geminiService';

global.fetch = vi.fn();

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- findLocationWithGemini ---

  it('returns null immediately when enableAI=false', async () => {
    const result = await findLocationWithGemini('São Paulo', false);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns location when enableAI=true and backend succeeds', async () => {
    const location = { lat: -22.15018, lng: -42.92185, label: 'Muriaé/MG' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => location
    });

    const result = await findLocationWithGemini('Muriaé', true);
    expect(result).toEqual(location);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null when backend returns non-ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });

    const result = await findLocationWithGemini('unknown city', true);
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const result = await findLocationWithGemini('São Paulo', true);
    expect(result).toBeNull();
  });

  // --- analyzeArea ---

  it('returns disabled message when enableAI=false', async () => {
    const result = await analyzeArea({ totalBuildings: 5 }, 'Test', false);
    expect(result).toBe('Analysis summary disabled.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns analysis text when enableAI=true and backend succeeds', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ analysis: 'Area has 5 buildings and good infrastructure.' })
    });

    const result = await analyzeArea({ totalBuildings: 5 }, 'Muriaé/MG', true);
    expect(result).toBe('Area has 5 buildings and good infrastructure.');
  });

  it('returns error message on non-ok with errorData.analysis', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ analysis: 'Serviço temporariamente indisponível.' })
    });

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toBe('Serviço temporariamente indisponível.');
  });

  it('returns error message on non-ok with message field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal error' })
    });

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toContain('Erro na análise');
    expect(result).toContain('Internal error');
  });

  it('returns JSON parse error fallback when non-ok response body is not JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); }
    });

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toContain('Erro na análise');
  });

  it('returns connection error message on network failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toContain('Erro de conexão');
  });

  it('returns error message using errorData.error field when analysis and message are absent', async () => {
    // Covers the `errorData.message || errorData.error || 'Analysis failed'` branch
    // where errorData.message is falsy but errorData.error is present
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Upstream API failed' })
    });

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toContain('Erro na análise');
    expect(result).toContain('Upstream API failed');
  });

  it('uses "Analysis failed" fallback when error response has no message, analysis, or error fields', async () => {
    // Covers `errorData.message || errorData.error || 'Analysis failed'` rightmost branch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    const result = await analyzeArea({}, 'Test', true);
    expect(result).toContain('Erro na análise');
    expect(result).toContain('Analysis failed');
  });
});
