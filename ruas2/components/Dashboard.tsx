
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AnalysisStats, Violation } from '../types';
import { Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
  stats: AnalysisStats;
  analysisText: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, analysisText }) => {
  const data = [
    { name: 'Edifícios', value: stats.totalBuildings, color: '#facc15' }, // Yellow
    { name: 'Vias', value: stats.totalRoads, color: '#f87171' }, // Red
    { name: 'Natureza', value: stats.totalNature, color: '#4ade80' }, // Green
  ];

  const isLoadingAI = analysisText === '';
  const isAIError = analysisText === 'Analysis failed.';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Objetos</p>
          <p className="text-2xl font-bold text-white">{stats.totalBuildings + stats.totalRoads + stats.totalNature}</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Alt. Máx</p>
          <p className="text-2xl font-bold text-blue-400">{stats.maxHeight.toFixed(1)}m</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Alt. Média</p>
          <p className="text-2xl font-bold text-blue-400">{stats.avgHeight.toFixed(1)}m</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Densidade</p>
          <p className="text-2xl font-bold text-purple-400">
            {stats.totalBuildings > 500 ? 'Alta' : stats.totalBuildings > 100 ? 'Média' : 'Baixa'}
          </p>
        </div>
      </div>

      {/* AI Analysis */}
      <div className={`p-4 rounded-lg border relative overflow-hidden ${isLoadingAI ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-800/30 border-indigo-500/50'}`}>
        <div className="flex items-center gap-2 mb-2">
           <Sparkles size={16} className={isLoadingAI ? "text-slate-600" : "text-indigo-400"} />
           <h3 className={`text-sm font-bold uppercase tracking-wider ${isLoadingAI ? "text-slate-600" : "text-indigo-400"}`}>
             Consultor Gemini
           </h3>
        </div>
        
        {isLoadingAI ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-2 bg-slate-800 rounded w-3/4"></div>
            <div className="h-2 bg-slate-800 rounded w-full"></div>
            <div className="h-2 bg-slate-800 rounded w-5/6"></div>
          </div>
        ) : (
          <p className="text-slate-300 text-sm leading-relaxed italic">
             "{analysisText}"
          </p>
        )}
      </div>

      {/* Violations / Audit List */}
      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
           <span>Auditoria de Engenharia</span>
           <span className="bg-slate-800 px-2 py-0.5 rounded text-white">{stats.violations.length}</span>
         </h4>
         
         <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
           {stats.violations.length === 0 ? (
             <div className="flex items-center gap-2 text-green-500 text-xs p-2 bg-green-900/10 rounded border border-green-900/20">
                <CheckCircle2 size={14} />
                <span>Nenhuma violação crítica detectada nos dados disponíveis.</span>
             </div>
           ) : (
             stats.violations.map(v => (
               <div key={v.id} className={`text-xs p-2 rounded border flex gap-2 ${v.type === 'critical' ? 'bg-red-900/20 border-red-900/50 text-red-300' : 'bg-yellow-900/10 border-yellow-900/30 text-yellow-300'}`}>
                 <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                 <span>{v.message}</span>
               </div>
             ))
           )}
         </div>
      </div>

      {/* Chart */}
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} layout="vertical">
             <XAxis type="number" hide />
             <YAxis dataKey="name" type="category" width={70} tick={{fill: '#94a3b8', fontSize: 10}} />
             <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', fontSize: 12 }}
                cursor={{fill: 'transparent'}}
             />
             <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
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
