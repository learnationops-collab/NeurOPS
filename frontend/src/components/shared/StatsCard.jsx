import Card from './ui/Card';

const StatsCard = ({ title, value, subtitle, icon: Icon, color }) => {
    return (
        <div className="relative group rounded-2xl bg-surface border border-base shadow-glass backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-primary/50">
            {/* Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50"></div>

            {/* Dynamic Glow based on color */}
            <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 transition-all group-hover:opacity-40 ${color.bg}`}></div>

            <div className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-full bg-opacity-10 backdrop-blur-sm ${color.bg} ${color.text} border border-white/5`}>
                        <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-muted text-[10px] uppercase font-bold tracking-[0.2em] mb-1">{title}</span>
                        <div className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                            {value}
                        </div>
                        {subtitle && (
                            <div className="mt-1 text-right">
                                <p className="text-xs text-muted font-medium flex items-center justify-end gap-2">
                                    {subtitle}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 w-full h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent ${color.from} to-transparent`}></div>
        </div>
    );
};

export default StatsCard;
