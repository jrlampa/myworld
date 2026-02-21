/**
 * Testes unitários para o hook useUndoRedo.
 *
 * Cobre: undo, redo, set (com commit=true e commit=false), saveSnapshot,
 * canUndo, canRedo, estado inicial, histórico ilimitado.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../src/hooks/useUndoRedo';

describe('useUndoRedo', () => {
  describe('estado inicial', () => {
    it('deve expor o valor inicial como estado presente', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      expect(result.current.state).toBe(0);
    });

    it('deve iniciar sem histórico (canUndo=false, canRedo=false)', () => {
      const { result } = renderHook(() => useUndoRedo('inicio'));
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('deve aceitar objeto como valor inicial', () => {
      const init = { x: 10, y: 20 };
      const { result } = renderHook(() => useUndoRedo(init));
      expect(result.current.state).toEqual(init);
    });
  });

  describe('setState (commit=true, padrão)', () => {
    it('deve atualizar o estado e habilitar undo', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => {
        result.current.setState(1);
      });
      expect(result.current.state).toBe(1);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('deve acumular histórico com múltiplos sets', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.setState(2); });
      act(() => { result.current.setState(3); });
      expect(result.current.state).toBe(3);
      expect(result.current.canUndo).toBe(true);
    });

    it('não deve criar entrada duplicada se o valor não mudou', () => {
      const { result } = renderHook(() => useUndoRedo('hello'));
      act(() => { result.current.setState('hello'); }); // sem mudança
      // Histórico não deve crescer
      act(() => { result.current.undo(); });
      // Undo sem histórico → estado permanece 'hello'
      expect(result.current.state).toBe('hello');
    });

    it('deve limpar o futuro (redo) ao fazer novo set', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); }); // estado=0, futuro=[1]
      expect(result.current.canRedo).toBe(true);
      act(() => { result.current.setState(99); }); // novo branch
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('setState (commit=false)', () => {
    it('deve atualizar o estado sem adicionar ao histórico', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => {
        result.current.setState(42, false);
      });
      expect(result.current.state).toBe(42);
      expect(result.current.canUndo).toBe(false); // sem histórico
    });

    it('deve permitir commit=false seguido de commit=true', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(5, false); }); // transient
      act(() => { result.current.setState(10); });       // commit
      expect(result.current.state).toBe(10);
      expect(result.current.canUndo).toBe(true);
    });
  });

  describe('undo', () => {
    it('deve restaurar o estado anterior', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); });
      expect(result.current.state).toBe(0);
    });

    it('deve habilitar redo após undo', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); });
      expect(result.current.canRedo).toBe(true);
    });

    it('não deve lançar exceção quando não há histórico (undo no-op)', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.undo(); }); // sem histórico
      expect(result.current.state).toBe(0);
    });

    it('deve suportar múltiplos undos em sequência', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.setState(2); });
      act(() => { result.current.setState(3); });
      act(() => { result.current.undo(); });
      act(() => { result.current.undo(); });
      expect(result.current.state).toBe(1);
    });

    it('deve manter o estado quando undo chega ao início', () => {
      const { result } = renderHook(() => useUndoRedo('inicio'));
      act(() => { result.current.setState('fim'); });
      act(() => { result.current.undo(); }); // volta ao início
      act(() => { result.current.undo(); }); // no-op
      expect(result.current.state).toBe('inicio');
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('redo', () => {
    it('deve restaurar o estado desfeito', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); });
      act(() => { result.current.redo(); });
      expect(result.current.state).toBe(1);
    });

    it('não deve lançar exceção quando não há redo disponível', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.redo(); }); // sem futuro
      expect(result.current.state).toBe(0);
    });

    it('deve suportar múltiplos redos em sequência', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.setState(2); });
      act(() => { result.current.setState(3); });
      act(() => { result.current.undo(); });
      act(() => { result.current.undo(); });
      act(() => { result.current.redo(); });
      act(() => { result.current.redo(); });
      expect(result.current.state).toBe(3);
    });

    it('deve limpar canRedo após o último redo', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); });
      act(() => { result.current.redo(); });
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('saveSnapshot', () => {
    it('deve salvar o estado atual no histórico sem modificar o presente', () => {
      const { result } = renderHook(() => useUndoRedo(5));
      act(() => { result.current.saveSnapshot(); });
      expect(result.current.state).toBe(5);
      expect(result.current.canUndo).toBe(true);
    });

    it('deve permitir undo após saveSnapshot + set(false)', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.saveSnapshot(); });
      act(() => { result.current.setState(100, false); }); // transient
      act(() => { result.current.undo(); }); // volta ao snapshot
      expect(result.current.state).toBe(0);
    });

    it('deve limpar o futuro ao salvar snapshot', () => {
      const { result } = renderHook(() => useUndoRedo(0));
      act(() => { result.current.setState(1); });
      act(() => { result.current.undo(); }); // futuro=[1]
      expect(result.current.canRedo).toBe(true);
      act(() => { result.current.saveSnapshot(); }); // limpa futuro
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('ciclo completo undo/redo com objetos', () => {
    it('deve gerenciar histórico de objetos complexos corretamente', () => {
      const { result } = renderHook(() =>
        useUndoRedo({ lat: -22.15018, lng: -42.92185 })
      );

      act(() => { result.current.setState({ lat: -23.5505, lng: -46.6333 }); });
      act(() => { result.current.setState({ lat: -19.9167, lng: -43.9345 }); });
      act(() => { result.current.undo(); });

      expect(result.current.state).toEqual({ lat: -23.5505, lng: -46.6333 });
      expect(result.current.canRedo).toBe(true);

      act(() => { result.current.redo(); });
      expect(result.current.state).toEqual({ lat: -19.9167, lng: -43.9345 });
    });
  });
});
