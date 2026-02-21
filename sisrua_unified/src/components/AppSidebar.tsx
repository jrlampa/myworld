import React from 'react';
import { Download, Map as MapIcon, Search, Loader2, AlertCircle, Mountain, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisStats, AppSettings, GeoLocation, SelectionMode } from '../types';
import { MIN_RADIUS, MAX_RADIUS } from '../constants';
import Dashboard from './Dashboard';
import DxfLegend from './DxfLegend';
import BatchUpload from './BatchUpload';
import { ToastType } from './Toast';

interface AppSidebarProps {
    isDark: boolean;
    // Busca
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    isSearching: boolean;
    handleSearch: (e: React.FormEvent) => void;
    center: GeoLocation;
    // Modo de seleção e raio
    selectionMode: SelectionMode;
    onSelectionModeChange: (mode: SelectionMode) => void;
    radius: number;
    onRadiusChange: (r: number) => void;
    onSaveSnapshot: () => void;
    isPolygonValid: boolean;
    // Análise
    isProcessing: boolean;
    onFetchAndAnalyze: () => void;
    error: string | null;
    osmData: any;
    stats: AnalysisStats | null;
    analysisText: string;
    terrainData: any;
    // Download DXF
    isDownloading: boolean;
    onDownloadDxf: () => void;
    // Toast
    onToast: (message: string, type: ToastType) => void;
}

/**
 * AppSidebar
 * Painel lateral com busca, controles de seleção, análise e exportação DXF.
 */
const AppSidebar: React.FC<AppSidebarProps> = ({
    isDark,
    searchQuery, setSearchQuery, isSearching, handleSearch, center,
    selectionMode, onSelectionModeChange,
    radius, onRadiusChange, onSaveSnapshot,
    isPolygonValid,
    isProcessing, onFetchAndAnalyze, error,
    osmData, stats, analysisText, terrainData,
    isDownloading, onDownloadDxf,
    onToast
}) => {
    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={`w-[400px] border-r flex flex-col p-8 gap-8 overflow-y-auto z-20 shadow-2xl transition-all scrollbar-hide ${isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200'}`}
        >
            {/* Cartão de Busca */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Área de Busca</label>
                </div>
                <form onSubmit={handleSearch} className="relative group">
                    <input
                        type="text"
                        placeholder='Cidade, Endereço ou Coords (UTM)'
                        aria-label="Buscar área"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white placeholder-slate-600 shadow-inner group-hover:border-white/10"
                    />
                    <Search className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <AnimatePresence>
                        {searchQuery && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                type="submit"
                                disabled={isSearching}
                                className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                            >
                                {isSearching ? <Loader2 className="animate-spin" size={12} /> : 'BUSCAR'}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </form>

                {center.label && (
                    <motion.div
                        layoutId="location-badge"
                        className="flex items-center gap-3 text-xs text-blue-400 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10"
                    >
                        <div className="p-1.5 bg-blue-500/10 rounded-lg">
                            <MapIcon size={14} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold truncate">{center.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono italic">{center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}</span>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="h-px bg-white/5 mx-2"></div>

            {/* Controles de Seleção */}
            <div className="space-y-6">
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Modo de Seleção</label>
                    </div>
                    <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
                        <button
                            onClick={() => onSelectionModeChange('circle')}
                            className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'circle' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            RAIO
                        </button>
                        <button
                            onClick={() => onSelectionModeChange('polygon')}
                            className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'polygon' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            POLÍGONO
                        </button>
                        <button
                            onClick={() => onSelectionModeChange('measure')}
                            className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === 'measure' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Modo Perfil"
                        >
                            <TrendingUp size={14} />
                        </button>
                    </div>
                </div>

                {selectionMode === 'circle' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Raio de Cobertura</label>
                            <div className="bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
                                <span className="text-xs font-mono font-bold text-blue-400">{radius}</span>
                                <span className="text-[10px] text-slate-600 ml-1">METROS</span>
                            </div>
                        </div>
                        <div className="relative pt-1">
                            <input
                                type="range"
                                min={MIN_RADIUS}
                                max={MAX_RADIUS}
                                step={10}
                                value={radius}
                                onMouseDown={onSaveSnapshot}
                                onTouchStart={onSaveSnapshot}
                                onChange={(e) => onRadiusChange(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                            />
                            <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-600 uppercase">
                                <span>{MIN_RADIUS}m</span>
                                <span>{MAX_RADIUS}m</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="h-px bg-white/5 mx-2"></div>

            {/* Botão de Ação Principal */}
            <div>
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onFetchAndAnalyze}
                    disabled={isProcessing || (selectionMode === 'polygon' && !isPolygonValid)}
                    className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-2xl ${isProcessing || (selectionMode === 'polygon' && !isPolygonValid)
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30'
                        }`}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            PROCESSANDO...
                        </>
                    ) : (
                        <>
                            <div className="p-1 rounded bg-white/10 group-hover:rotate-12 transition-transform">
                                <TrendingUp size={16} />
                            </div>
                            ANALISAR REGIÃO
                        </>
                    )}
                </motion.button>
            </div>

            {/* Exibição de Erros */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-rose-400 text-sm overflow-hidden"
                    >
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <p className="font-medium">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resultados da Análise */}
            <AnimatePresence>
                {osmData && stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-6 mt-auto overflow-visible"
                    >
                        <div className="h-px bg-white/5 mx-2"></div>
                        <Dashboard stats={stats} analysisText={analysisText} />

                        <DxfLegend />

                        <BatchUpload
                            onError={(message) => onToast(message, 'error')}
                            onInfo={(message) => onToast(message, 'info')}
                        />

                        <div className="flex items-center gap-3 p-4 glass rounded-2xl">
                            <div className={`p-2 rounded-lg ${terrainData ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                                <Mountain size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">MOTOR TERRENO</span>
                                <span className="text-xs font-bold text-slate-200">{terrainData ? 'Grade de Alta Resolução Carregada' : 'Grade Pendente...'}</span>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, x: 5 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onDownloadDxf}
                            disabled={isDownloading}
                            className="group w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : (
                                <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                                    <Download size={18} />
                                </div>
                            )}
                            {isDownloading ? 'GERANDO...' : 'BAIXAR DXF'}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.aside>
    );
};

export default AppSidebar;
