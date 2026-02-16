import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnalysisStats } from '../types';

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    { name: 'Buildings', value: stats.totalBuildings, color: '#facc15' }, // Yellow
    { name: 'Roads', value: stats.totalRoads, color: '#f87171' }, // Red
    { name: 'Nature', value: stats.totalNature, color: '#4ade80' }, // Green
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Objects</p>
          <p className="text-2xl font-bold text-white">{stats.totalBuildings + stats.totalRoads + stats.totalNature}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Max Height</p>
          <p className="text-2xl font-bold text-blue-400">{stats.maxHeight.toFixed(1)}m</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Avg Height</p>
          <p className="text-2xl font-bold text-blue-400">{stats.avgHeight.toFixed(1)}m</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Density</p>
          <p className="text-2xl font-bold text-purple-400">
            {stats.totalBuildings > 500 ? 'High' : stats.totalBuildings > 100 ? 'Med' : 'Low'}
          </p>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-slate-800/30 p-4 rounded-lg border-l-4 border-indigo-500">
        <h3 className="text-sm font-semibold text-indigo-400 mb-1">Gemini Analysis</h3>
        <p className="text-slate-300 text-sm leading-relaxed italic">
          "{analysisText}"
        </p>
      </div>

      {/* Chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
             <XAxis type="number" hide />
             <YAxis dataKey="name" type="category" width={80} tick={{fill: '#94a3b8', fontSize: 12}} />
             <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                cursor={{fill: 'transparent'}}
             />
             <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
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
