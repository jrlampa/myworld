import React from 'react';
import { Palette } from 'lucide-react';
import { motion } from 'framer-motion';

const LEGEND_ITEMS = [
    { label: 'EDIFÍCIOS', color: '#FFFF00', layer: 'Amarelo' },
    { label: 'RODOVIAS', color: '#FF0000', layer: 'Vermelho' },
    { label: 'VIAS PRINCIPAIS', color: '#FF00FF', layer: 'Magenta' },
    { label: 'VIAS LOCAIS', color: '#FF7F00', layer: 'Laranja' },
    { label: 'VEGETAÇÃO', color: '#00FF00', layer: 'Verde' },
    { label: 'HIDROGRAFIA', color: '#0000FF', layer: 'Azul' },
    { label: 'INFRAESTRUTURA', color: '#00FFFF', layer: 'Ciano' },
    { label: 'TERRENO / CURVAS', color: '#999999', layer: 'Cinza' },
];

const DxfLegend: React.FC = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 shadow-2xl"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1 px-2 rounded bg-purple-500/20 border border-purple-500/30">
                    <Palette size={14} className="text-purple-400" />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Padrão de Cores DXF</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {LEGEND_ITEMS.map((item, idx) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-2 text-[9px] text-slate-400 group cursor-default"
                    >
                        <div
                            className="w-3 h-3 rounded-[3px] shadow-sm flex-shrink-0 border border-white/10 group-hover:scale-125 transition-transform"
                            style={{ backgroundColor: item.color }}
                        />
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-300 group-hover:text-white transition-colors uppercase">{item.label}</span>
                            <span className="text-[7px] text-slate-500 font-medium">INDEX: {item.layer.toUpperCase()}</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

export default DxfLegend;
