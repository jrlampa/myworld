import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  data: {
    buildings: number;
    roads: number;
    trees: number;
    poles: number;
    totalArea: number;
    totalLength: number;
    violations: number;
    coverageScore: number;
  } | null;
  onAskAI: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, onAskAI }) => {
  if (!data) {
    return (
      <div className="dashboard-container glass empty">
        <h2>Engineering Dashboard</h2>
        <p>Generate a DXF to see spatial analytics.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container glass animate-fade-in">
      <div className="dashboard-header flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold">Engineering Insights</h2>
        <div className="flex gap-3">
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2" onClick={() => window.print()}>
            <span>📄</span> Export PDF Report
          </button>
          <button className="ai-btn pulse" onClick={onAskAI}>
            <span>✨</span> Ask AI Auditor
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="print-only report-header hidden mb-8">
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Projetos RUAS</h1>
            <p className="text-slate-600 font-semibold">Relatório de Auditoria de Infraestrutura</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Documento Gerado em:</p>
            <p className="text-sm font-bold text-slate-800">{new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-6">
          <div className="site-info glass-light p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Resumo da Localidade</h3>
            <p className="text-sm text-slate-700">Edificações: <span className="font-bold">{data.buildings}</span></p>
            <p className="text-sm text-slate-700">Malha Viária: <span className="font-bold">{(data.totalLength / 1000).toFixed(2)} km</span></p>
            <p className="text-sm text-slate-700">Infraestrutura: <span className="font-bold">{data.poles} postes/torres</span></p>
          </div>
          <div className="audit-metrics glass-light p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Métricas de Auditoria</h3>
            <p className="text-sm text-slate-700">Violações de Proximidade: <span className="font-bold text-red-600">{data.violations}</span></p>
            <p className="text-sm text-slate-700">Eficiência de Iluminação: <span className="font-bold text-blue-600">{data.coverageScore}%</span></p>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass">
          <label>Buildings</label>
          <div className="value">{data.buildings}</div>
          <p className="subtext">Sum: {data.totalArea.toLocaleString()} m²</p>
        </div>
        <div className="stat-card glass">
          <label>Road Network</label>
          <div className="value">{data.roads}</div>
          <p className="subtext">Len: {(data.totalLength / 1000).toFixed(2)} km</p>
        </div>
        <div className="stat-card glass">
          <label>Infrastructure</label>
          <div className="value">{data.poles}</div>
          <p className="subtext">Poles & Towers</p>
        </div>
        <div className="stat-card glass">
          <label>Environment</label>
          <div className="value">{data.trees}</div>
          <p className="subtext">Mapped Trees</p>
        </div>
      </div>

      <div className="dashboard-charts grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feature Density */}
        <div className="chart-item glass p-4 rounded-xl">
          <label className="text-sm font-semibold text-gray-400">Feature Density</label>
          <div className="bar-container mt-4">
            <div className="bar buildings" style={{ width: `${Math.min(100, (data.buildings / 500) * 100)}%` }}></div>
            <div className="bar roads" style={{ width: `${Math.min(100, (data.roads / 200) * 100)}%` }}></div>
            <div className="bar poles" style={{ width: `${Math.min(100, (data.poles / 100) * 100)}%` }}></div>
          </div>
          <div className="chart-legend flex gap-4 mt-2 text-xs">
            <span>🔵 Buildings</span>
            <span>🔴 Roads</span>
            <span>🟡 Poles</span>
          </div>
        </div>

        {/* Safety Audit Card */}
        <div className="chart-item glass p-4 rounded-xl border border-red-500/10">
          <label className="text-sm font-semibold text-red-400">🛡️ Safety Audit</label>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Proximity Violations</span>
              <span className={`text-sm font-bold ${data.violations > 0 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                {data.violations} points
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Lighting Coverage</span>
              <span className="text-sm font-bold text-yellow-400">
                {data.coverageScore}%
              </span>
            </div>
            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] text-gray-500 italic">
                {data.violations > 0
                  ? "⚠️ Critical: Buildings detected inside power line buffers."
                  : "✅ Safe: No buildings detected in restricted zones."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
