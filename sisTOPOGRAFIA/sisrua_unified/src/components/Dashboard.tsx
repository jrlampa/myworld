import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnalysisStats } from '../types';

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    { name: 'Edificações', value: stats.totalBuildings, color: '#facc15' }, // Yellow
    { name: 'Vias', value: stats.totalRoads, color: '#f87171' }, // Red
    { name: 'Natureza', value: stats.totalNature, color: '#4ade80' }, // Green
  ];

  return (
    <div className="glass-panel p-6 rounded-xl shadow-lg space-y-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel-hover p-4 rounded-lg">
          <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold">Objetos</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalBuildings + stats.totalRoads + stats.totalNature}</p>
        </div>
        <div className="glass-panel-hover p-4 rounded-lg">
          <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold">Altura Máx.</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--enterprise-blue)' }}>{stats.maxHeight.toFixed(1)}m</p>
        </div>
        <div className="glass-panel-hover p-4 rounded-lg">
          <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold">Altura Média</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--enterprise-blue)' }}>{stats.avgHeight.toFixed(1)}m</p>
        </div>
        <div className="glass-panel-hover p-4 rounded-lg">
          <p className="text-slate-600 text-xs uppercase tracking-wider font-semibold">Densidade</p>
          <p className="text-2xl font-bold text-purple-600">
            {stats.totalBuildings > 500 ? 'Alta' : stats.totalBuildings > 100 ? 'Média' : 'Baixa'}
          </p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-lg border-l-4" style={{ borderLeftColor: 'var(--enterprise-blue)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--enterprise-blue)' }}>Resumo da Análise</h3>
        <p className="text-slate-700 text-sm leading-relaxed italic">
          "{analysisText}"
        </p>
      </div>

      {/* Chart */}
      <div className="h-48 w-full glass-panel p-4 rounded-lg">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} layout="vertical">
             <XAxis type="number" hide />
             <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
             <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  borderColor: 'rgba(255, 255, 255, 0.5)', 
                  color: '#1e293b',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '0.5rem',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)'
                }}
                cursor={{fill: 'rgba(6, 182, 212, 0.05)'}}
             />
             <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
             </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
