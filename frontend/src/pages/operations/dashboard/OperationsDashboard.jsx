import React from 'react';
import { motion } from 'framer-motion';
import {
    Cpu,
    Database,
    Server,
    Activity,
    Terminal,
    Search,
    RefreshCcw,
    AlertCircle,
    HardDrive,
    Shield
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';

const OperationsDashboard = () => {
    // Mock technical metrics
    const technicalStats = [
        { label: 'Uptime Servidor', value: '99.98%', change: '+0.01%', icon: Server, color: 'text-emerald-500' },
        { label: 'Uso de CPU', value: '24%', change: 'Normal', icon: Cpu, color: 'text-primary' },
        { label: 'DB Latency', value: '18ms', change: '-2ms', icon: Database, color: 'text-amber-500' },
        { label: 'Storage', value: '14.2/50GB', icon: HardDrive, color: 'text-indigo-500' },
    ];

    const technicalLogs = [
        { time: '18:02:15', type: 'INFO', message: 'Backup diario completado exitosamente', module: 'System' },
        { time: '17:45:02', type: 'WARN', message: 'Pico de latencia detectado en API /analytics', module: 'Network' },
        { time: '17:30:44', type: 'SUCCESS', message: 'Nuevas migraciones aplicadas: add_sales_admin_role', module: 'DB' },
        { time: '16:15:21', type: 'ERROR', message: 'Fallo al conectar con webhook externo ( ManyChat )', module: 'Hooks' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 space-y-10"
        >
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-5xl font-black italic tracking-tighter text-base leading-none">
                        Operations Console
                    </h1>
                    <p className="text-[10px] font-black tracking-[0.3em] text-muted mt-2 uppercase">
                        System Health & Infrastructure Management
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="px-6 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                        <Activity size={18} className="text-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black tracking-[0.2em] text-emerald-500 uppercase">ALL SYSTEMS OPERATIONAL</span>
                    </div>
                </div>
            </header>

            {/* Hardware/System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {technicalStats.map((stat, idx) => (
                    <Card key={idx} variant="surface" className="p-8 relative overflow-hidden group hover:border-primary/30 transition-all border-white/5">
                        <div className={`p-3 rounded-2xl bg-surface border border-base w-fit ${stat.color} mb-6`}>
                            <stat.icon size={20} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-muted tracking-widest uppercase">{stat.label}</p>
                            <h3 className="text-3xl font-black italic tracking-tighter text-base">{stat.value}</h3>
                        </div>
                        {stat.change && (
                            <div className="absolute top-8 right-8 text-[9px] font-bold text-muted bg-surface/50 px-2 py-1 rounded-lg border border-base uppercase tracking-widest">
                                {stat.change}
                            </div>
                        )}
                        <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                            <stat.icon size={120} />
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tech Log Viewer */}
                <Card variant="surface" className="lg:col-span-2 p-8 space-y-8 bg-[#0a0b0e] border-white/5">
                    <div className="flex justify-between items-center border-b border-white/5 pb-6">
                        <div className="flex items-center gap-3">
                            <Terminal size={18} className="text-primary" />
                            <h3 className="text-[11px] font-black tracking-[0.2em] uppercase">Registros de Sistema (Real-time)</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input type="text" placeholder="FILTER LOGS..." className="bg-main border border-base rounded-xl py-2 pl-9 pr-4 text-[9px] font-black outline-none w-48 focus:border-primary/50 transition-all" />
                            </div>
                            <button className="p-2 bg-surface border border-base rounded-xl text-muted hover:text-primary transition-all">
                                <RefreshCcw size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 font-mono">
                        {technicalLogs.map((log, idx) => (
                            <div key={idx} className="flex gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all text-xs group">
                                <span className="text-muted tracking-tight w-20 shrink-0">{log.time}</span>
                                <span className={`font-black w-14 shrink-0 text-center rounded px-1 ${log.type === 'SUCCESS' ? 'text-emerald-500 bg-emerald-500/10' :
                                        log.type === 'ERROR' ? 'text-rose-500 bg-rose-500/10' :
                                            log.type === 'WARN' ? 'text-amber-500 bg-amber-500/10' : 'text-blue-500 bg-blue-500/10'
                                    }`}>{log.type}</span>
                                <span className="text-muted/60 font-black uppercase tracking-widest w-16 shrink-0">[{log.module}]</span>
                                <span className="text-base font-medium truncate group-hover:text-primary transition-colors">{log.message}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Technical Quick Actions */}
                <div className="space-y-6">
                    <Card variant="surface" className="p-8 space-y-6">
                        <div className="flex items-center gap-3">
                            <Shield size={18} className="text-primary" />
                            <h3 className="text-[11px] font-black tracking-[0.2em] uppercase">Control Técnico</h3>
                        </div>
                        <div className="space-y-3">
                            <button className="w-full p-4 bg-main border border-base rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-3">
                                    <Database size={16} className="text-muted group-hover:text-primary" />
                                    <span className="text-[10px] font-black tracking-widest uppercase">Optimizar DB</span>
                                </div>
                                <RefreshCcw size={14} className="text-muted" />
                            </button>
                            <button className="w-full p-4 bg-main border border-base rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-3">
                                    <Server size={16} className="text-muted group-hover:text-primary" />
                                    <span className="text-[10px] font-black tracking-widest uppercase">Restart Worker</span>
                                </div>
                                <Activity size={14} className="text-muted" />
                            </button>
                        </div>
                    </Card>

                    <Card variant="surface" className="p-8 bg-rose-500/5 border-rose-500/20 group hover:bg-rose-500 transition-all duration-500 cursor-pointer overflow-hidden relative">
                        <div className="relative z-10 space-y-2">
                            <div className="flex items-center gap-2 text-rose-500 group-hover:text-white transition-colors">
                                <AlertCircle size={20} />
                                <h3 className="text-xl font-black italic tracking-tighter">Emergency</h3>
                            </div>
                            <p className="text-[10px] font-bold text-muted uppercase group-hover:text-white/60 transition-colors tracking-widest">ACTIVAR MODO COLD-BACKUP</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-20 transition-opacity">
                            <Server size={120} />
                        </div>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
};

export default OperationsDashboard;
