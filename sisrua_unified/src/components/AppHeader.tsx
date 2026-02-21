import React from 'react';
import { Layers, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import HistoryControls from './HistoryControls';

interface AppHeaderProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onOpenSettings: () => void;
    isDark: boolean;
}

/**
 * AppHeader
 * Cabeçalho principal da aplicação com logo, controles de histórico e configurações.
 */
const AppHeader: React.FC<AppHeaderProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onOpenSettings,
    isDark
}) => {
    return (
        <header className={`h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 transition-all ${isDark ? 'border-white/5 bg-[#020617]/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
            <div className="flex items-center gap-4">
                <motion.div
                    whileHover={{ rotate: 180 }}
                    className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"
                >
                    <Layers size={22} className="text-white" />
                </motion.div>
                <div>
                    <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                        SIS RUA <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">UNIFIED</span>
                    </h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Análise Geoespacial Avançada</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <HistoryControls
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={onUndo}
                    onRedo={onRedo}
                />
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onOpenSettings}
                    className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
                    title="Configurações"
                >
                    <Settings size={20} />
                </motion.button>
            </div>
        </header>
    );
};

export default AppHeader;
