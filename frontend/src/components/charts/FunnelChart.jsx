import React from 'react';
import { ResponsiveContainer, FunnelChart as RechartsFunnelChart, Funnel, LabelList, Tooltip, Cell } from 'recharts';

const FunnelChart = ({ data }) => {
    // data expected format: [{ name: 'Stage Name', value: 100, fill: '#8884d8' }, ...]

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-muted text-sm">
                No hay datos suficientes para el gráfico
            </div>
        );
    }

    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <RechartsFunnelChart>
                    <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b' }}
                        itemStyle={{ color: '#1e293b' }}
                        formatter={(value, name) => [value, name]}
                    />
                    <Funnel
                        dataKey="value"
                        data={data}
                        isAnimationActive
                    >
                        <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={10} fontWeight="900" />
                        <LabelList position="center" fill="#ffffff" stroke="none" dataKey="value" fontSize={14} fontWeight="bold" />
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                        ))}
                    </Funnel>
                </RechartsFunnelChart>
            </ResponsiveContainer>
        </div>
    );
};

export default FunnelChart;
