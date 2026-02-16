import React from 'react';
import { Palette } from 'lucide-react';

const LEGEND_ITEMS = [
  { label: 'Edifícios (Amarelo)', color: '#FFFF00' },
  { label: 'Rodovias (Vermelho)', color: '#FF0000' },
  { label: 'Vias Principais (Magenta)', color: '#FF00FF' },
  { label: 'Vias Locais (Laranja)', color: '#FF7F00' },
  { label: 'Natureza (Verde)', color: '#00FF00' },
  { label: 'Água (Azul)', color: '#0000FF' },
  { label: 'Infraestrutura (Ciano)', color: '#00FFFF' },
  { label: 'Terreno (Cinza)', color: '#999999' },
];

const DxfLegend: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Palette size={16} className="text-purple-400" />
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legenda de Cores DXF</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[10px] text-slate-400">
            <div 
              className="w-2.5 h-2.5 rounded-sm shadow-sm flex-shrink-0" 
              style={{ backgroundColor: item.color }} 
            />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DxfLegend;