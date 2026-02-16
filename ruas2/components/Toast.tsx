
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <CheckCircle2 className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };

  const bgColors = {
    success: 'bg-slate-900 border-green-500/50',
    error: 'bg-slate-900 border-red-500/50',
    info: 'bg-slate-900 border-blue-500/50'
  };

  return (
    <div className={`fixed top-4 right-4 z-[1000] flex items-center gap-3 p-4 rounded-lg border shadow-2xl animate-in slide-in-from-top-5 fade-in duration-300 max-w-sm w-full ${bgColors[type]}`}>
      <div className="shrink-0">
        {icons[type]}
      </div>
      <p className="text-sm font-medium text-slate-200 flex-1">
        {message}
      </p>
      <button 
        onClick={onClose}
        className="text-slate-500 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
