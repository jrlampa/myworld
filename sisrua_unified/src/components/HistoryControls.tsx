import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';

interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({ canUndo, canRedo, onUndo, onRedo }) => {
  return (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-1.5 rounded transition-colors ${
          canUndo 
            ? 'text-slate-300 hover:bg-slate-700 hover:text-white' 
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Undo"
      >
        <Undo2 size={18} />
      </button>
      <div className="w-px h-4 bg-slate-700 mx-1" />
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`p-1.5 rounded transition-colors ${
          canRedo 
            ? 'text-slate-300 hover:bg-slate-700 hover:text-white' 
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Redo"
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
};

export default HistoryControls;