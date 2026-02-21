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

  it('downloadDxf: result with neither url nor jobId throws and calls onError', async () => {
    (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 'processing' });

    const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

    let downloadResult: boolean | undefined;
    await act(async () => {
      downloadResult = await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
    });

    expect(downloadResult).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('DXF Error:'));
    expect(result.current.jobStatus).toBe('failed');
    expect(result.current.isDownloading).toBe(false);
  });

  describe('polling useEffect', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('polling: completed status triggers download and cleanup', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-poll-1' });
      (getDxfJobStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'completed',
        progress: 100,
        result: { url: '/downloads/result.dxf', filename: 'result.dxf' }
      });

      const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      expect(result.current.jobId).toBe('job-poll-1');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(onSuccess).toHaveBeenCalledWith('DXF Downloaded');
      expect(result.current.jobId).toBeNull();
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.jobStatus).toBe('completed');
      expect(result.current.jobProgress).toBe(100);
    });

    it('polling: failed status with error string calls onError and cleans up', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-fail-1' });
      (getDxfJobStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'failed',
        error: 'Python engine error'
      });

      const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(onError).toHaveBeenCalledWith('DXF Error: Python engine error');
      expect(result.current.jobId).toBeNull();
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.jobStatus).toBe('failed');
    });

    it('polling: failed status without error field uses default message', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-fail-2' });
      (getDxfJobStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'failed'
      });

      const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(onError).toHaveBeenCalledWith('DXF Error: DXF generation failed');
      expect(result.current.jobId).toBeNull();
    });

    it('polling: getDxfJobStatus throws → catches and calls onError', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-err-1' });
      (getDxfJobStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('API unreachable')
      );

      const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(onError).toHaveBeenCalledWith('DXF Error: API unreachable');
      expect(result.current.jobId).toBeNull();
      expect(result.current.jobStatus).toBe('failed');
    });

    it('polling: completed job with no URL throws catches as error', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-nourl' });
      (getDxfJobStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'completed',
        progress: 100,
        result: { filename: 'result.dxf' }  // no url
      });

      const { result } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('DXF Error:')
      );
      expect(result.current.jobStatus).toBe('failed');
    });

    it('polling: cleanup on unmount stops interval via isActive guard', async () => {
      (generateDXF as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ jobId: 'job-unmount' });

      const { result, unmount } = renderHook(() => useDxfExport({ onSuccess, onError }));

      await act(async () => {
        await result.current.downloadDxf(CENTER, 500, 'circle', [], {}, 'utm');
      });

      expect(result.current.jobId).toBe('job-unmount');

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      expect(getDxfJobStatus).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
