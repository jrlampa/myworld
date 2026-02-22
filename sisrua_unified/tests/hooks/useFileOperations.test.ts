import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileOperations } from '../../src/hooks/useFileOperations';
import { GlobalState } from '../../src/types';

const mockAppState: GlobalState = {
  center: { lat: -22.15018, lng: -42.92185, label: 'Muriaé/MG' },
  radius: 500,
  selectionMode: 'circle',
  polygon: [],
  measurePath: [],
  settings: {
    enableAI: false,
    simplificationLevel: 'low',
    orthogonalize: true,
    projection: 'utm',
    theme: 'dark',
    mapProvider: 'vector',
    contourInterval: 5,
    layers: {
      buildings: true,
      roads: true,
      curbs: true,
      nature: true,
      terrain: true,
      contours: false,
      slopeAnalysis: false,
      furniture: true,
      labels: true,
      dimensions: false,
      grid: false
    },
    projectMetadata: {
      projectName: 'TEST_PROJECT',
      companyName: 'TEST_COMPANY',
      engineerName: 'TEST_ENGINEER',
      date: '2026-02-21',
      scale: '1:500',
      revision: 'R00'
    }
  }
};

describe('useFileOperations', () => {
  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let setAppState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onSuccess = vi.fn();
    onError = vi.fn();
    setAppState = vi.fn();

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should initialize with isLoading=false', () => {
    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('saveProject: creates blob, triggers download, calls onSuccess', () => {
    const mockClick = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    act(() => {
      result.current.saveProject();
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(onSuccess).toHaveBeenCalledWith('Project Saved');
    expect(onError).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('saveProject: calls onError when createObjectURL throws', () => {
    (global.URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('Blob failed');
    });

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    act(() => {
      result.current.saveProject();
    });

    expect(onError).toHaveBeenCalledWith('Failed to save project');
  });

  it('loadProject: reads valid JSON and calls setAppState + onSuccess', async () => {
    const projectData = { state: mockAppState, version: '1.0.0' };
    const file = new File([JSON.stringify(projectData)], 'project.osmpro', { type: 'application/json' });

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    await act(async () => {
      result.current.loadProject(file);
    });

    await waitFor(() => {
      expect(setAppState).toHaveBeenCalledWith(mockAppState, true);
      expect(onSuccess).toHaveBeenCalledWith('Project Loaded');
    });
  });

  it('loadProject: calls onError for invalid JSON structure (missing state)', async () => {
    const file = new File([JSON.stringify({ wrongField: 'bad' })], 'bad.osmpro', { type: 'application/json' });

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    await act(async () => {
      result.current.loadProject(file);
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to load project');
    });
  });

  it('loadProject: calls onError for malformed JSON', async () => {
    const file = new File(['not valid json {{{{'], 'corrupt.osmpro', { type: 'application/json' });

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    await act(async () => {
      result.current.loadProject(file);
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to load project');
    });
  });

  it('loadProject: calls onError on FileReader.onerror', async () => {
    const MockFileReader = vi.fn().mockImplementation(function(this: any) {
      this.readAsText = vi.fn().mockImplementation(() => {
        setTimeout(() => this.onerror(), 0);
      });
    });
    const origFileReader = global.FileReader;
    global.FileReader = MockFileReader as any;

    const { result } = renderHook(() =>
      useFileOperations({ appState: mockAppState, setAppState, onSuccess, onError })
    );

    const file = new File(['data'], 'f.osmpro');
    await act(async () => {
      result.current.loadProject(file);
      await new Promise(r => setTimeout(r, 10));
    });

    expect(onError).toHaveBeenCalledWith('Failed to read file');
    global.FileReader = origFileReader;
  });
});
