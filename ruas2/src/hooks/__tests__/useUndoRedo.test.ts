import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useUndoRedo } from '../useUndoRedo';

describe('useUndoRedo Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should update state and add to history', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canUndo).toBe(true);
  });

  it('should undo state correctly', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
    });
    act(() => {
      result.current.setState({ count: 2 });
    });

    expect(result.current.state).toEqual({ count: 2 });

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo state correctly', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0 }));

    act(() => {
      result.current.setState({ count: 1 });
    });
    act(() => {
      result.current.undo();
    });
    
    expect(result.current.state).toEqual({ count: 0 });

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ count: 1 });
  });

  it('should verify LocalStorage persistence', () => {
    const key = 'test-key';
    const { result } = renderHook(() => useUndoRedo({ count: 0 }, key));

    act(() => {
      result.current.setState({ count: 99 });
    });

    const stored = localStorage.getItem(key);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual({ count: 99 });
  });

  it('should load initial state from LocalStorage if available', () => {
    const key = 'test-key-load';
    localStorage.setItem(key, JSON.stringify({ count: 500 }));

    const { result } = renderHook(() => useUndoRedo({ count: 0 }, key));
    expect(result.current.state).toEqual({ count: 500 });
  });
});