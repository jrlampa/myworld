import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/dxfService', () => ({
  generateDXF: vi.fn(),
  getDxfJobStatus: vi.fn()
}));

import { generateDXF, getDxfJobStatus } from '../../src/services/dxfService';
import { useDxfExport } from '../../src/hooks/useDxfExport';

const CENTER = { lat: -22.15018, lng: -42.92185, label: 'Muriaé/MG' };

describe('useDxfExport', () => {
  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onSuccess = vi.fn();
    onError = vi.fn();

    const mockClick = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.jobStatus).toBe('idle');
    expect(result.current.jobProgress).toBe(0);
    expect(result.current.jobId).toBeNull();
  });

  it('downloadDxf: handles immediate url response', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'success',
      url: 'http://localhost:3001/downloads/test.dxf'
    });

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    let downloadResult: boolean | undefined;
    await act(async () => {
      downloadResult = await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
    });

    expect(downloadResult).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.jobStatus).toBe('completed');
    expect(result.current.jobProgress).toBe(100);
  });

  it('downloadDxf: sets jobId when backend queues the job', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'queued',
      jobId: 'job-123'
    });

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    let downloadResult: boolean | undefined;
    await act(async () => {
      downloadResult = await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
    });

    expect(downloadResult).toBe(true);
    expect(result.current.jobId).toBe('job-123');
    expect(result.current.isDownloading).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('downloadDxf: handles generateDXF returning null', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    let downloadResult: boolean | undefined;
    await act(async () => {
      downloadResult = await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
    });

    expect(downloadResult).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('DXF Error:'));
  });

  it('downloadDxf: handles generateDXF network error', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    let downloadResult: boolean | undefined;
    await act(async () => {
      downloadResult = await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
    });

    expect(downloadResult).toBe(false);
    expect(onError).toHaveBeenCalledWith('DXF Error: Network down');
  });

  it('downloadDxf: default projection (no explicit projection arg)', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'success',
      url: '/downloads/local.dxf'
    });

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    await act(async () => {
      await result.current.downloadDxf(CENTER, 100, 'circle', [], {});
    });

    expect(generateDXF).toHaveBeenCalledWith(
      CENTER.lat, CENTER.lng, 100, 'circle', [], {}, 'utm'
    );
    expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
  });

  it('getDxfJobStatus is exported and callable', () => {
    expect(typeof getDxfJobStatus).toBe('function');
  });
});
