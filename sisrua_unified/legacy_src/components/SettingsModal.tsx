import React, { useState } from 'react';
import usePersistentState from '../hooks/usePersistentState';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: any;
  onLayersChange: (layers: any) => void;
  crs: string;
  onCrsChange: (crs: string) => void;
  exportFormat: string;
  onExportFormatChange: (format: string) => void;
  showAnalysis: boolean;
  onShowAnalysisChange: (show: boolean) => void;
  clientName: string;
  onClientNameChange: (val: string) => void;
  projectId: string;
  onProjectIdChange: (val: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  layers,
  onLayersChange,
  crs,
  onCrsChange,
  exportFormat,
  onExportFormatChange,
  showAnalysis,
  onShowAnalysisChange,
  clientName,
  onClientNameChange,
  projectId,
  onProjectIdChange,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'crs' | 'project' | 'api'>('layers');
  const [groqKey, setGroqKey] = usePersistentState<string>('groq_api_key', '');

  if (!isOpen) return null;

  const handleLayerToggle = (key: string) => {
    onLayersChange({ ...layers, [key]: !layers[key] });
  };

  return (
    <div className="modal-overlay glass animate-fade-in shadow-xl" onClick={onClose}>
      <div className="modal-content glass-dark border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
            System Settings
          </h2>
          <button className="close-btn hover:rotate-90 transition-transform" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-tabs flex gap-4 mb-6 border-b border-white/5 pb-2">
          <button
            className={`tab-btn px-4 py-2 rounded-lg transition-all ${activeTab === 'layers' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('layers')}
          >
            📋 Layers
          </button>
          <button
            className={`tab-btn px-4 py-2 rounded-lg transition-all ${activeTab === 'crs' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('crs')}
          >
            🌐 System & Export
          </button>
          <button
            className={`tab-btn px-4 py-2 rounded-lg transition-all ${activeTab === 'project' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('project')}
          >
            📂 Project
          </button>
          <button
            className={`tab-btn px-4 py-2 rounded-lg transition-all ${activeTab === 'api' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('api')}
          >
            🔑 API Keys
          </button>
        </div>

        <div className="modal-body overflow-y-auto max-h-[60vh] pr-2">
          {activeTab === 'layers' && (
            <div className="layers-grid grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.buildings} onChange={() => handleLayerToggle('buildings')} />
                <span className="text-gray-200">Buildings (3D)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.roads} onChange={() => handleLayerToggle('roads')} />
                <span className="text-gray-200">Road Network</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.trees} onChange={() => handleLayerToggle('trees')} />
                <span className="text-gray-200">Trees & Context</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.amenities} onChange={() => handleLayerToggle('amenities')} />
                <span className="text-gray-200">Amenities (Poles)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.terrain} onChange={() => handleLayerToggle('terrain')} />
                <span className="text-gray-200">Include Terrain (DTM)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.streetWidths} onChange={() => handleLayerToggle('streetWidths')} />
                <span className="text-gray-200">Street Widths</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.highResContours} onChange={() => handleLayerToggle('highResContours')} />
                <span className="text-gray-200">High-Res Contours</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input type="checkbox" checked={layers.furniture} onChange={() => handleLayerToggle('furniture')} />
                <span className="text-gray-200">Street Furniture (Benches, Lamps)</span>
              </label>

              <div className="col-span-full mt-4 pt-4 border-t border-white/5">
                <h4 className="text-sm font-semibold text-blue-400 mb-3">🛡️ Engineering Analysis</h4>
                <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 cursor-pointer transition-colors hover:bg-blue-500/20">
                  <input
                    type="checkbox"
                    checked={showAnalysis}
                    onChange={(e) => onShowAnalysisChange(e.target.checked)}
                  />
                  <div>
                    <span className="text-white block font-medium">Safety Proximity Analysis</span>
                    <span className="text-xs text-blue-300/70">Visualize power line safety buffers and street lamp coverage.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'crs' && (
            <div className="crs-section space-y-6">
              <div className="crs-card glass p-4 rounded-xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-3">Target Coordinate System</label>
                <select
                  title="Target Coordinate System"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={crs}
                  onChange={(e) => onCrsChange(e.target.value)}
                >
                  <option value="auto">Automatic UTM (Recommended)</option>
                  <option value="EPSG:31983">SIRGAS 2000 / Zone 23S</option>
                  <option value="EPSG:31982">SIRGAS 2000 / Zone 22S</option>
                  <option value="EPSG:31984">SIRGAS 2000 / Zone 24S</option>
                </select>
              </div>

              <div className="crs-card glass p-4 rounded-xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-3">Master Export Format</label>
                <select
                  title="Master Export Format"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                  value={exportFormat}
                  onChange={(e) => onExportFormatChange(e.target.value)}
                >
                  <option value="dxf">AutoCAD DXF (.dxf)</option>
                  <option value="kml">Google Earth (.kml)</option>
                  <option value="geojson">GIS GeoJSON (.geojson)</option>
                  <option value="shapefile">ESRI Shapefile (.shp)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ This defines the primary output format. Meta-CSV is always generated.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'project' && (
            <div className="project-section space-y-4">
              <div className="api-card glass p-4 rounded-xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Company / Client Name</label>
                <input
                  type="text"
                  placeholder="ACME Engineering Ltd."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={clientName}
                  onChange={(e) => onClientNameChange(e.target.value)}
                />
              </div>
              <div className="api-card glass p-4 rounded-xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Project ID / Name</label>
                <input
                  type="text"
                  placeholder="Urban-2026-X"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={projectId}
                  onChange={(e) => onProjectIdChange(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="api-section space-y-4">
              <div className="api-card glass p-4 rounded-xl border border-white/5">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Groq Cloud API Key</label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer flex mt-6 pt-4 border-t border-white/5">
          <button className="confirm-btn ml-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
