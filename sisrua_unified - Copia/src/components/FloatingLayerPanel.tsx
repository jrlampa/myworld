import React, { useState } from 'react';
import { Layers, Building2, Car, TreeDeciduous, Mountain, LampFloor, Type, ChevronRight, Map as MapIcon } from 'lucide-react';
import { AppSettings, LayerConfig } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingLayerPanelProps {
    settings: AppSettings;
    onUpdateSettings: (s: AppSettings) => void;
    isDark: boolean;
}

const FloatingLayerPanel: React.FC<FloatingLayerPanelProps> = ({ settings, onUpdateSettings, isDark }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleLayer = (key: keyof LayerConfig) => {
        onUpdateSettings({
            ...settings,
            layers: {
                ...settings.layers,
                [key]: !settings.layers[key]
            }
        });
    };

    const LayerButton = ({ label, icon: Icon, active, onClick, colorClass }: any) => (
        <motion.button
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            title={label}
            className={`flex items-center w-full p-2 rounded-lg transition-all duration-200 border ${active
                ? `${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white/50 border-slate-200'} text-blue-400 shadow-sm`
                : 'border-transparent text-slate-500 hover:bg-white/5'
                }`}
        >
            <div className={`p-1.5 rounded-md ${active ? 'bg-slate-800/80 shadow-inner' : ''}`}>
                <Icon size={16} className={active ? colorClass : 'grayscale opacity-50'} />
            </div>
            <AnimatePresence mode="wait">
                {isExpanded && (
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className={`ml-3 text-[11px] font-semibold tracking-wide uppercase ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-3"
        >
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center justify-center w-10 h-10 rounded-xl glass shadow-lg transition-colors ${isDark
                    ? 'hover:text-blue-400'
                    : 'text-slate-600 hover:text-blue-500'
                    }`}
            >
                <Layers size={20} className={isExpanded ? 'text-blue-400' : ''} />
            </motion.button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="glass p-2.5 rounded-2xl w-44 flex flex-col gap-1.5 shadow-2xl origin-top-right"
                    >
                        <div className="px-2 py-1 mb-1 border-b border-white/5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Camadas</span>
                        </div>
                        <LayerButton
                            label="Edifícios"
                            icon={Building2}
                            active={settings.layers.buildings}
                            onClick={() => toggleLayer('buildings')}
                            colorClass="text-yellow-400"
                        />
                        <LayerButton
                            label="Vias / Ruas"
                            icon={Car}
                            active={settings.layers.roads}
                            onClick={() => toggleLayer('roads')}
                            colorClass="text-rose-400"
                        />
                        <LayerButton
                            label="Vegetação"
                            icon={TreeDeciduous}
                            active={settings.layers.nature}
                            onClick={() => toggleLayer('nature')}
                            colorClass="text-emerald-400"
                        />
                        <LayerButton
                            label="Terreno 3D"
                            icon={Mountain}
                            active={settings.layers.terrain}
                            onClick={() => toggleLayer('terrain')}
                            colorClass="text-violet-400"
                        />
                        <LayerButton
                            label="Mobiliário"
                            icon={LampFloor}
                            active={settings.layers.furniture}
                            onClick={() => toggleLayer('furniture')}
                            colorClass="text-amber-400"
                        />
                        <LayerButton
                            label="Rótulos"
                            icon={Type}
                            active={settings.layers.labels}
                            onClick={() => toggleLayer('labels')}
                            colorClass="text-sky-400"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default FloatingLayerPanel;
