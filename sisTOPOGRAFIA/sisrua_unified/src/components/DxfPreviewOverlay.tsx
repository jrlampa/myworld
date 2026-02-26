import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize, ZoomIn, ZoomOut, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Use a dynamic import or checking if library exists
// Using any for the viewer since it lacks full TS definitions out-of-the-box in some versions
let DxfViewer: any;
let THREE: any;

interface DxfPreviewOverlayProps {
    dxfUrl: string | null;
    onClose: () => void;
    onDownload: () => void;
}

const DxfPreviewOverlay: React.FC<DxfPreviewOverlayProps> = ({ dxfUrl, onClose, onDownload }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!dxfUrl || !containerRef.current) return;

        let isMounted = true;

        const loadViewer = async () => {
            try {
                // Dynamically import to prevent SSR issues or bundle size blocks
                const dxfViewerModule = await import('dxf-viewer');
                const threeModule = await import('three');

                DxfViewer = dxfViewerModule.DxfViewer;
                THREE = threeModule;

                if (!isMounted) return;

                viewerRef.current = new DxfViewer(containerRef.current, {
                    autoResize: true,
                    clearColor: new THREE.Color('#0f172a'), // deep slate
                });

                await viewerRef.current.Load({ url: dxfUrl });

                if (isMounted) {
                    setIsLoading(false);
                    // Optional: fit to screen
                    viewerRef.current.FitToCanvas();
                }
            } catch (err: any) {
                console.error("Failed to load DXF Viewer:", err);
                if (isMounted) {
                    setError("Não foi possível carregar a visualização 3D/2D do CAD.");
                    setIsLoading(false);
                }
            }
        };

        loadViewer();

        return () => {
            isMounted = false;
            if (viewerRef.current) {
                viewerRef.current.Destroy();
            }
        };
    }, [dxfUrl]);

    if (!dxfUrl) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/90 backdrop-blur-xl animate-in fade-in duration-300">

            {/* Header Panel */}
            <div className="absolute top-0 left-0 right-0 h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <CheckCircle2 size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-sm uppercase tracking-widest">DXF Gerado</h2>
                        <p className="text-[10px] text-slate-400 font-mono">Pré-visualização Interativa (WebGL)</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onDownload}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400/20"
                    >
                        <Download size={16} /> Download File
                    </button>

                    <div className="w-px h-6 bg-white/10" />

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Canvas Container */}
            <div className="w-full h-full pt-16 relative">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                        <p className="text-slate-400 text-sm font-mono tracking-widest animate-pulse">RENDERIZANDO VETORES CAD...</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900">
                        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl max-w-md text-center">
                            <p className="text-rose-400 font-medium mb-4">{error}</p>
                            <button onClick={onDownload} className="btn-enterprise text-white bg-slate-800 px-4 py-2 rounded-lg">
                                Fazer o Download Diretamente
                            </button>
                        </div>
                    </div>
                )}

                {/* The DOM element dxf-viewer attaches to */}
                <div ref={containerRef} className="w-full h-full cursor-crosshair outline-none" style={{ backgroundColor: '#0f172a' }} />

                {/* Toolbar Controls */}
                {!isLoading && !error && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl"
                    >
                        <button
                            onClick={() => viewerRef.current?.FitToCanvas()}
                            className="p-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                            title="Ajustar à tela"
                        >
                            <Maximize size={18} />
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <p className="text-[10px] text-slate-500 font-mono px-3">Scroll to Zoom • Left-Click to Pan</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default DxfPreviewOverlay;
