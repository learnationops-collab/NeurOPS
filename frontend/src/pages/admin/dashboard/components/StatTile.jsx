import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { Users, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Counter from '../../../../components/ui/Counter';

const ICON_MAP = {
    'agendas': Users,
    'sales': TrendingUp,
    'cash_collect': DollarSign
};

const COLOR_MAP = {
    'agendas': 'text-primary',
    'sales': 'text-secondary',
    'cash_collect': 'text-emerald-500'
};

const StatTile = ({ metric, filters, size = '1x2' }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const Icon = ICON_MAP[metric] || Users;

    const [width, height] = size.split('x').map(Number);

    // Layout logic mapping
    const isSquareSmall = width === 1 && height === 1; // 1x1
    const isWideShort = width === 2 && height === 1;   // 2x1
    const isPortrait = width === 1 && height === 2;    // 1x2
    const isShort = height === 1;
    const isLarge = width >= 2 && height >= 2;         // 2x2, 4x2 etc.
    const isXLarge = width >= 4;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams({
                    metric,
                    period: filters.period,
                    start_date: filters.start_date || '',
                    end_date: filters.end_date || ''
                });
                const res = await api.get(`/analytics/data?${queryParams.toString()}`);
                setData(res.data);
            } catch (err) {
                console.error("Error fetching tile data", err);
            } finally {
                setLoading(false);
            }
        };

        if (filters) {
            fetchData();
        }
    }, [metric, filters]);

    // Padding based on size
    const padding = isSquareSmall ? 'p-3' : (isLarge ? 'p-8' : 'p-6');

    return (
        <Card variant="surface" className={`relative group overflow-hidden border-base/50 hover:border-primary/40 transition-all duration-700 h-full bg-surface/30 backdrop-blur-xl ${padding}`}>
            {/* Background Accent - Brand Glow */}
            <div className={`absolute top-0 right-0 ${isLarge ? 'w-64 h-64' : 'w-32 h-32'} -mr-16 -mt-16 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700`} />

            <div className={`flex h-full relative z-10 ${isWideShort ? 'flex-row items-center gap-4' : 'flex-col'}`}>

                {/* Icon Section - Hidden in 1x1 mode per user request */}
                {!isSquareSmall && (
                    <div className={`flex items-center gap-3 ${isWideShort ? 'shrink-0' : 'mb-4'}`}>
                        <div className={`p-3 rounded-2x2 bg-surface-hover/50 ${COLOR_MAP[metric] || 'text-primary'} border border-base/50 shadow-inner group-hover:scale-110 transition-transform duration-700`}>
                            <Icon size={isWideShort ? 16 : (isLarge ? 24 : 20)} />
                        </div>
                        {!isShort && (
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-muted uppercase tracking-[0.25em] mb-1">
                                    {data?.label || metric.replace('_', ' ')}
                                </span>
                                <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest leading-none">Métrica</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Section */}
                <div className={`flex flex-col h-full ${isWideShort ? 'justify-center flex-1' : (isSquareSmall ? 'justify-center items-center' : 'justify-end')}`}>
                    <div className={`flex ${isWideShort ? 'items-center justify-between' : 'flex-col items-start'} gap-1 w-full`}>
                        {loading ? (
                            <div className="h-10 flex items-center">
                                <Loader2 className="animate-spin text-primary/30" size={isSquareSmall || isWideShort ? 16 : 24} />
                            </div>
                        ) : (
                            <div className={`flex items-baseline gap-1 min-w-0 ${isSquareSmall ? 'justify-center w-full' : ''}`}>
                                {data?.unit === '$' && (
                                    <span className={`${isSquareSmall ? 'text-xs' : (isWideShort ? 'text-xl' : (isLarge ? 'text-4xl' : 'text-2xl'))} font-black text-primary italic opacity-40 select-none mr-0.5`}>
                                        $
                                    </span>
                                )}
                                <span className={`${isSquareSmall ? 'text-2xl' : (isWideShort ? 'text-4xl' : (isPortrait ? 'text-4xl' : (isXLarge ? 'text-7xl' : (isLarge ? 'text-6xl' : 'text-4xl'))))} font-black text-white italic tracking-tighter leading-none drop-shadow-brand truncate`}>
                                    <Counter value={data?.value || 0} />
                                </span>
                            </div>
                        )}
                        {(isWideShort || isSquareSmall) && (
                            <span className={`text-[8px] font-black text-muted uppercase tracking-widest truncate ${isSquareSmall ? 'mt-1 opacity-90 text-center w-full' : 'max-w-[100px] text-right ml-auto'}`}>
                                {data?.label || metric.replace('_', ' ')}
                            </span>
                        )}
                    </div>

                    {!isShort && !isSquareSmall && (
                        <div className="flex items-center gap-3 mt-4">
                            <div className="flex gap-0.5">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`h-1 rounded-full ${i === 1 ? 'w-6 bg-primary shadow-brand-glow' : 'w-1 bg-white/10'}`} />
                                ))}
                            </div>
                            <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em] leading-none">
                                {loading ? 'Calculando...' : 'Optimizado'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Bottom Accent */}
            {!isShort && !isSquareSmall && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </Card>
    );
};

export default StatTile;
