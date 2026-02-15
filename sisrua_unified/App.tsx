import React, { useState, useEffect } from 'react';
import { Download, Map as MapIcon, Layers, Search, Loader2, AlertCircle, Settings, Mountain, TrendingUp } from 'lucide-react';
import { OsmElement, AnalysisStats, TerrainGrid, GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import MapSelector from './components/MapSelector';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/HistoryControls';
import DxfLegend from './components/DxfLegend';
import FloatingLayerPanel from './components/FloatingLayerPanel';
import ElevationProfile from './components/ElevationProfile';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import { useUndoRedo } from './hooks/useUndoRedo';
import { motion, AnimatePresence } from 'framer-motion';

import { fetchOsmData } from './services/osmService';
import { generateDXF, calculateStats } from './services/dxfService';
import { findLocationWithGemini, analyzeArea } from './services/geminiService';
import { fetchElevationGrid, fetchElevationProfile } from './services/elevationService';
import { parseKml } from './utils/kmlParser';

function App() {
  // Global State with Undo/Redo
  const {
    state: appState,
    setState: setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot
  } = useUndoRedo<GlobalState>({
    center: DEFAULT_LOCATION,
    radius: 500,
    selectionMode: 'circle',
    polygon: [],
    measurePath: [],
    settings: {
      enableAI: true,
      simplificationLevel: 'low',
      orthogonalize: true,
      projection: 'local',
      theme: 'dark',
      mapProvider: 'vector',
      contourInterval: 5,
      layers: {
        buildings: true,
        roads: true,
        curbs: true,
        nature: true,
        terrain: true,
        contours: false,
        slopeAnalysis: false,
        furniture: true,
        labels: true,
        dimensions: false,
        grid: false
      },
      projectMetadata: {
        projectName: 'PROJECT OSM-01',
        companyName: 'ENG CORP',
        engineerName: 'ENG. LEAD',
        date: new Date().toLocaleDateString('en-US'),
        scale: 'N/A',
        revision: 'R00'
      }
    }
  });

  // Derived state from undoable appState
  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

  // Ephemeral State (No undo)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  const [showSettings, setShowSettings] = useState(false);

  const [osmData, setOsmData] = useState<OsmElement[] | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainGrid | null>(null);
  const [elevationProfileData, setElevationProfileData] = useState<{ dist: number, elev: number }[]>([]);

  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Toast State
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  // Update Settings Wrapper
  const updateSettings = (newSettings: AppSettings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  // Handlers
  const handleMapClick = (newCenter: GeoLocation) => {
    // When manually clicking, we treat it as a new distinct action in history
    setAppState({ ...appState, center: newCenter }, true);

    // Clear existing data as coordinates changed
    setOsmData(null);
    setTerrainData(null);
    setStats(null);
  };

  const handlePolygonChange = (newPolygon: GeoLocation[]) => {
    // Convert [lat,lng] arrays to GeoLocation if needed, but MapSelector gives [number, number][]
    // Wait, MapSelector calls onPolygonChange with [number, number][].
    // My GlobalState expects GeoLocation[]. I need to map it.
    // Actually MapSelector usually manages internal state but reports back.
    // Let's check MapSelector again. It calls setPolygonPoints with [number, number][].
    // But here I'm using it in appState.
    // I should map [number, number] to GeoLocation
    // Wait, let's fix the type in GlobalState to match or map it here.
    // GlobalState has polygon: GeoLocation[].
    // MapSelector's onPolygonChange gives [number, number][].

    // FIX logic:
    // This function receives [number, number][] from MapSelector
    // BUT MapSelector currently calls onPolygonChange with the raw array suitable for Leaflet.

    // I need to adapt the callback in the JSX below.
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);
  };

  const handleMeasurePathChange = async (path: [number, number][]) => {
    // Convert to GeoLocation[]
    const geoPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setAppState({ ...appState, measurePath: geoPath }, false);

    if (geoPath.length === 2) {
      // Fetch profile from backend (Smart Backend)
      const profile = await fetchElevationProfile(geoPath[0], geoPath[1]);
      setElevationProfileData(profile);
    } else {
      setElevationProfileData([]);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // Direct call to backend search (which handles UTM + AI)
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      if (!response.ok) throw new Error("Location not found");

      const location = await response.json();

      if (location) {
        setAppState({ ...appState, center: location }, true);
        setOsmData(null);
        setTerrainData(null);
        setStats(null);
        showToast(`Location found: ${location.label}`, 'success');
      }
    } catch (err: any) {
      const msg = err.message || "Search failed";
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchAndAnalyze = async () => {
    setIsProcessing(true);
    setError(null);
    setStatusMessage('Starting...');
    setProgressValue(10);

    try {
      // 1. Fetch OSM Data
      setStatusMessage('Fetching OSM Data...');
      const data = await fetchOsmData(center.lat, center.lng, radius);
      if (data.length === 0) {
        throw new Error("No data found in this area. Try increasing the radius.");
      }
      setOsmData(data);
      setProgressValue(40);

      // 2. Fetch Terrain Data
      setStatusMessage('Fetching Elevation Data...');
      const terrain = await fetchElevationGrid(center, radius);
      setTerrainData(terrain);
      setProgressValue(70);

      // 3. Calculate Stats
      const calculatedStats = calculateStats(data);
      setStats(calculatedStats);
      setProgressValue(85);

      // 4. Get AI Analysis (Groq/Gemini)
      if (settings.enableAI) {
        setStatusMessage('Analyzing with AI...');
        const text = await analyzeArea(calculatedStats, center.label || "the selected area", true);
        setAnalysisText(text);
      } else {
        setAnalysisText("AI Analysis Disabled.");
      }

      setProgressValue(100);
      showToast("Analysis Complete!", 'success');
      setStatusMessage('');

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setStatusMessage('');
      showToast(err.message || 'Error', 'error');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgressValue(0);
      }, 1000);
    }
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    setIsDownloading(true);
    setStatusMessage('Generating DXF on server...');
    try {
      const result = await generateDXF(
        center.lat,
        center.lng,
        radius,
        selectionMode,
        polygon,
        settings.layers
      );

      if (result && result.url) {
        // Trigger download
        const a = document.createElement('a');
        a.href = result.url;
        a.download = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("DXF Downloaded", 'success');
      } else {
        throw new Error("Backend failed to generate DXF");
      }

    } catch (e: any) {
      console.error(e);
      setError(`Failed to download DXF: ${e.message}`);
      showToast("DXF Generation Failed", 'error');
    } finally {
      setIsDownloading(false);
      setStatusMessage('');
    }
  };

  const handleDownloadGeoJSON = async () => {
    if (!osmData) return;
    showToast("GeoJSON export not implemented in client yet.", 'info');
  };

  const handleKmlDrop = async (file: File) => {
    try {
      setStatusMessage('Parsing KML...');
      const points = await parseKml(file);

      if (points.length > 0) {
        // Points are [lat, lng]
        const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));

        setAppState({
          ...appState,
          selectionMode: 'polygon',
          polygon: geoPoints,
          center: {
            lat: points[0][0],
            lng: points[0][1],
            label: file.name.replace('.kml', '')
          }
        }, true);

        setStatusMessage('KML Imported Successfully');
        showToast("KML Imported", 'success');
      }
    } catch (err: any) {
      setError("KML Import Failed: " + err.message);
      showToast("KML Fail", 'error');
    } finally {
      setTimeout(() => setStatusMessage(''), 2000);
    }
  };

  const handleSaveProject = () => {
    const projectData = {
      state: appState,
      timestamp: new Date().toISOString(),
      version: "3.0.0"
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.projectMetadata.projectName}.osmpro`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Project Saved", 'success');
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (data && data.state) {
          setAppState(data.state, true);
          showToast("Project Loaded", 'success');
        }
      } catch (err) {
        showToast("Failed to load project", 'error');
      }
    };
    reader.readAsText(file);
  };

  // Get current location on mount (only if center is default)
  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          setAppState({
            ...appState,
            center: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: "Current Location"
            }
          }, false);
        }, (_err) => {
          console.log("Geolocation permission denied, using default.");
        });
      }
    }
  }, []);

  // Helpers
  const isPolygonValid = (selectionMode === 'polygon' && polygon.length >= 3);

  // Memoized points to prevent unnecessary re-renders of the map
  const polygonPoints = React.useMemo(() =>
    polygon.map(p => [p.lat, p.lng] as [number, number]),
    [polygon]);

  const measurePathPoints = React.useMemo(() =>
    measurePath.map(p => [p.lat, p.lng] as [number, number]),
    [measurePath]);

  return (
    <div className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>

      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <ProgressIndicator
        isVisible={isProcessing || isDownloading}
        progress={progressValue}
        message={statusMessage}
      />

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            key="settings"
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            onUpdateSettings={updateSettings}
            selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange}
            radius={radius}
            onRadiusChange={(r) => setAppState({ ...appState, radius: r }, false)}
            polygon={polygon}
            onClearPolygon={() => setAppState({ ...appState, polygon: [] }, true)}
            hasData={!!osmData}
            isDownloading={isDownloading}
            onExportDxf={handleDownloadDxf}
            onExportGeoJSON={handleDownloadGeoJSON}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        )}
      </AnimatePresence>

      {/* Premium Header */}
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
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Advanced Geo Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          <div className="hidden lg:flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
              <div className={`w-1.5 h-1.5 rounded-full ${settings.enableAI ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
              <span>{settings.enableAI ? "AI Ready" : "AI Inactive"}</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(true)}
            className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
          >
            <Settings size={20} />
          </motion.button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Animated Sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`w-[400px] border-r flex flex-col p-8 gap-8 overflow-y-auto z-20 shadow-2xl transition-all scrollbar-hide ${isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200'}`}
        >
          {/* Search Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Area</label>
            </div>
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder='City, Address or Coords (UTM)'
                aria-label="Search area"
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
                    {isSearching ? <Loader2 className="animate-spin" size={12} /> : "FIND"}
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

          {/* Control Section */}
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Selection Mode</label>
              </div>
              <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
                <button
                  onClick={() => handleSelectionModeChange('circle')}
                  className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'circle' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  RADIUS
                </button>
                <button
                  onClick={() => handleSelectionModeChange('polygon')}
                  className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'polygon' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  POLYGON
                </button>
                <button
                  onClick={() => handleSelectionModeChange('measure')}
                  className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === 'measure' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Profile Mode"
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Region Radius</label>
                  <div className="bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
                    <span className="text-xs font-mono font-bold text-blue-400">{radius}</span>
                    <span className="text-[10px] text-slate-600 ml-1">METERS</span>
                  </div>
                </div>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    step={10}
                    value={radius}
                    onMouseDown={saveSnapshot}
                    onTouchStart={saveSnapshot}
                    onChange={(e) => setAppState({ ...appState, radius: parseInt(e.target.value) }, false)}
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

          {/* Action Button */}
          <div>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleFetchAndAnalyze}
              disabled={isProcessing || (selectionMode === 'polygon' && !isPolygonValid)}
              className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-2xl ${isProcessing || (selectionMode === 'polygon' && !isPolygonValid)
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30'
                }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  PROCESSING...
                </>
              ) : (
                <>
                  <div className="p-1 rounded bg-white/10 group-hover:rotate-12 transition-transform">
                    <TrendingUp size={16} />
                  </div>
                  ANALYZE REGION
                </>
              )}
            </motion.button>
          </div>

          {/* Error Display */}
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

          {/* Analysis Results */}
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

                <div className="flex items-center gap-3 p-4 glass rounded-2xl">
                  <div className={`p-2 rounded-lg ${terrainData ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                    <Mountain size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">TERRAIN ENGINE</span>
                    <span className="text-xs font-bold text-slate-200">{terrainData ? 'High Resolution Grid Loaded' : 'Grid Pending...'}</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownloadDxf}
                  disabled={isDownloading}
                  className="group w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? <Loader2 className="animate-spin" size={18} /> : (
                    <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                      <Download size={18} />
                    </div>
                  )}
                  {isDownloading ? 'GENERATING...' : 'DOWNLOAD DXF'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* Map Viewport */}
        <div className={`flex-1 relative z-10 transition-all duration-700 ${osmData ? 'opacity-100' : 'opacity-90 grayscale-[0.2]'}`}>
          <MapSelector
            center={center}
            radius={radius}
            selectionMode={selectionMode}
            polygonPoints={polygonPoints}
            onLocationChange={handleMapClick}
            onPolygonChange={(points) => {
              const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));
              setAppState({ ...appState, polygon: geoPoints }, true);
            }}
            measurePath={measurePathPoints}
            onMeasurePathChange={handleMeasurePathChange}
            onKmlDrop={handleKmlDrop}
            mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
          />

          <FloatingLayerPanel
            settings={settings}
            onUpdateSettings={updateSettings}
            isDark={isDark}
          />

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <ElevationProfile
                data={elevationProfileData}
                onClose={() => { setElevationProfileData([]); handleSelectionModeChange('circle'); }}
                isDark={isDark}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;