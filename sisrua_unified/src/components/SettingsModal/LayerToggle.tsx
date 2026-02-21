import React from 'react';

interface LayerToggleProps {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  colorClass: string;
}

const LayerToggle: React.FC<LayerToggleProps> = ({ label, icon: Icon, active, onClick, colorClass }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg border transition-all glass-panel-hover ${active
      ? 'border-white/40 shadow-md'
      : 'border-white/20 hover:border-white/30'
      }`}
    style={active ? { color: 'var(--enterprise-blue)' } : { color: '#64748b' }}
  >
    <div className={`p-2 rounded-md ${active ? colorClass : 'bg-white/20'}`}>
      <Icon size={18} className={active ? 'text-white' : 'text-slate-500'} />
    </div>
    <span className="text-sm font-semibold">{label}</span>
    <div className={`ml-auto w-3 h-3 rounded-full ${active ? 'shadow-md' : 'bg-slate-400'}`}
      style={active ? { backgroundColor: 'var(--enterprise-blue)' } : {}} />
  </button>
);

export default LayerToggle;
