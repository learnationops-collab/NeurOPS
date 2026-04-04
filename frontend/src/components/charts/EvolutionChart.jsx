import React, { useState } from 'react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
    CartesianGrid, Legend, Cell 
} from 'recharts';

const EvolutionChart = ({ data, variables }) => {
    // data format: [{ date: '2023-01-01', var1: 10, var2: 20 }, ...]
    // variables format: [{ key: 'var1', label: 'Label 1', color: '#6366f1' }, ...]
    
    const [selectedVars, setSelectedVars] = useState(variables ? variables.map(v => v.key) : []);

    if (!data || !variables || data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-slate-400 bg-white/50 rounded-3xl border border-dashed border-slate-200 uppercase text-[10px] font-black tracking-widest italic">
                Cargando historial de evolución...
            </div>
        );
    }

    const toggleVar = (key) => {
        if (selectedVars.includes(key)) {
            setSelectedVars(selectedVars.filter(v => v !== key));
        } else {
            setSelectedVars([...selectedVars, key]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                {variables.map(v => (
                    <button
                        key={v.key}
                        onClick={() => toggleVar(v.key)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all border ${
                            selectedVars.includes(v.key)
                                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400'
                                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:text-slate-400'
                        }`}
                        style={selectedVars.includes(v.key) ? { borderColor: `${v.color}50`, color: v.color, backgroundColor: `${v.color}10` } : {}}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            fontSize={9} 
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                            stroke="#94a3b8"
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis 
                            fontSize={9} 
                            stroke="#94a3b8"
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                color: '#1e293b'
                            }}
                            itemStyle={{ padding: '2px 0' }}
                            labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                            cursor={{ fill: '#00000005' }}
                        />
                        {variables.map(v => selectedVars.includes(v.key) && (
                            <Bar 
                                key={v.key} 
                                dataKey={v.key} 
                                name={v.label} 
                                fill={v.color} 
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default EvolutionChart;
