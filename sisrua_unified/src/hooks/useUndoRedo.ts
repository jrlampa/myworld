import { useState, useCallback } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: []
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const set = useCallback((newPresent: T, commit: boolean = true) => {
    setState(currentState => {
      if (commit) {
        // Prevent duplicate history entries if value hasn't effectively changed
        if (JSON.stringify(currentState.present) === JSON.stringify(newPresent)) {
            return currentState;
        }
        return {
          past: [...currentState.past, currentState.present],
          present: newPresent,
          future: []
        };
      } else {
        return {
          ...currentState,
          present: newPresent
        };
      }
    });
  }, []);

  // Use this before starting a continuous change (like dragging a slider)
  // that will update using set(val, false)
  const saveSnapshot = useCallback(() => {
     setState(currentState => {
         return {
             ...currentState,
             past: [...currentState.past, currentState.present],
             future: []
         };
     });
  }, []);

  return {
    state: state.present,
    setState: set,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot
  };
}