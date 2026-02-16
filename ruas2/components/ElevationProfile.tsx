
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X, TrendingUp } from 'lucide-react';

interface ElevationProfileProps {
  data: { dist: number, elev: number }[];
  onClose: () => void;
  isDark: boolean;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({ data, onClose, isDark }) => {
  if (!data || data.length === 0) return null;

  const minElev = Math.min(...data.map(d => d.elev));
  const maxElev = Math.max(...data.map(d => d.elev));
  const heightDiff = maxElev - minElev;

  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-[450] rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-10 ${isDark ? 'bg-slate-900/90 border-slate-700 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-800'}`}>
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
           <TrendingUp size={18} className="text-blue-500" />
           <h3 className="text-sm font-bold uppercase tracking-wider">Perfil do Terreno</h3>
           <span className="text-xs opacity-60 ml-2">Δ {heightDiff.toFixed(1)}m</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/10 p-1 rounded transition-colors">
           <X size={16} />
        </button>
      </div>
      
      <div className="h-48 w-full p-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} vertical={false} />
            <XAxis 
                dataKey="dist" 
                tick={{fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b'}} 
                tickFormatter={(val) => `${val}m`}
            />
            <YAxis 
                domain={['auto', 'auto']} 
                tick={{fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b'}}
                width={30}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#fff', 
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    fontSize: '12px',
                    borderRadius: '8px'
                }}
                formatter={(val: number) => [`${val.toFixed(1)}m`, 'Elevação']}
                labelFormatter={(val) => `Distância: ${val}m`}
            />
            <Area 
                type="monotone" 
                dataKey="elev" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorElev)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ElevationProfile;
