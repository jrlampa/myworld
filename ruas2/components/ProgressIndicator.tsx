
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressIndicatorProps {
  isVisible: boolean;
  progress: number; // 0 to 100
  message: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ isVisible, progress, message }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[900] w-80 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-blue-500" size={16} />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Processando</span>
        </div>
        <span className="text-xs font-mono text-blue-400">{Math.round(progress)}%</span>
      </div>
      
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-slate-400 truncate animate-pulse">
        {message}
      </p>
    </div>
  );
};

export default ProgressIndicator;
