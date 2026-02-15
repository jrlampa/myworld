import React from 'react';

interface ControlPanelProps {
  radius: number;
  onRadiusChange: (radius: number) => void;
  outputName: string;
  onOutputNameChange: (name: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  logs: { status: string, message: string }[];
  onOpenSettings: () => void;
  selectionMode: 'circle' | 'polygon';
  onSelectionModeChange: (mode: 'circle' | 'polygon') => void;
  onClearPolygon: () => void;
  onUndoPolygon: () => void;
  polygonPointsCount: number;
  exportFormat: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  radius, onRadiusChange,
  outputName, onOutputNameChange,
  onGenerate, isGenerating,
  logs,
  onOpenSettings,
  selectionMode, onSelectionModeChange,
  onClearPolygon, onUndoPolygon,
  polygonPointsCount,
  exportFormat
}) => {
  return (
    <div className="glass control-panel">
      <div className="panel-header">
        <h2 className="settings-title">Control Panel</h2>
        <button className="settings-icon-btn" onClick={onOpenSettings} title="Settings">
          ⚙️
        </button>
      </div>

      <div className="control-group">
        <label className="control-label">Selection Mode</label>
        <div className="flex gap-2">
          <button
            className={`flex-1 p-2 rounded-lg text-sm transition-all ${selectionMode === 'circle' ? 'bg-blue-600/50 border border-blue-400/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
            onClick={() => onSelectionModeChange('circle')}
          >
            ⭕ Circle
          </button>
          <button
            className={`flex-1 p-2 rounded-lg text-sm transition-all ${selectionMode === 'polygon' ? 'bg-purple-600/50 border border-purple-400/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
            onClick={() => onSelectionModeChange('polygon')}
          >
            📐 Polygon
          </button>
        </div>
      </div>

      {selectionMode === 'circle' ? (
        <div className="control-group">
          <label className="control-label">Search Radius: <span style={{ color: 'white' }}>{radius}m</span></label>
          <div className="range-container">
            <span style={{ fontSize: '0.8rem' }}>50m</span>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={radius}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="range-input"
            />
            <span style={{ fontSize: '0.8rem' }}>2km</span>
          </div>
        </div>
      ) : (
        <div className="control-group">
          <label className="control-label flex justify-between">
            Polygon Points <span>{polygonPointsCount}</span>
          </label>
          <div className="flex gap-2">
            <button
              className="flex-1 p-1 text-xs rounded border border-white/10 hover:bg-white/5"
              onClick={onUndoPolygon}
              disabled={polygonPointsCount === 0}
            >
              Undo Last
            </button>
            <button
              className="flex-1 p-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={onClearPolygon}
              disabled={polygonPointsCount === 0}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      <div className="control-group">
        <label className="control-label">Output Filename</label>
        <input
          type="text"
          value={outputName}
          onChange={(e) => onOutputNameChange(e.target.value)}
          className="text-input"
          placeholder="e.g. my_city_center.dxf"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="generate-btn"
      >
        {isGenerating ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="spinner"></span> Generating...
          </span>
        ) : `Generate ${exportFormat.toUpperCase()}`}
      </button>

      <div className="logs-container">
        {logs.length === 0 && <div style={{ color: '#64748b' }}>Waiting for action...</div>}
        {logs.map((log, index) => (
          <div key={index} className={`log-item ${log.status === 'error' ? 'log-error' : log.status === 'success' ? 'log-success' : 'log-info'}`}>
            <span style={{ opacity: 0.5 }}>[{index + 1}]</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ControlPanel;
