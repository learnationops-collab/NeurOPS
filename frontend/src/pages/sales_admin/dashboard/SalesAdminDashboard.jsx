import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    TrendingUp,
    Target,
    Zap,
    ChevronRight,
    Activity,
    DollarSign,
    Calendar,
    BarChart3
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button'; // Added Button import

const SalesAdminDashboard = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState(0);

    // Listen for section change requests from DOCK
    useEffect(() => {
        const handleRequest = (e) => {
            const { index } = e.detail;
            setActiveSection(index);
        };
        window.addEventListener('request-section-change', handleRequest);
        return () => window.removeEventListener('request-section-change', handleRequest);
    }, []);

    // Send active section to Dock
    useEffect(() => {
        const category = 'Sales Portal';
        const event = new CustomEvent('page-section-changed', {
            detail: { activeSection, category }
        });
        window.dispatchEvent(event);
    }, [activeSection]);

    // Mock data for the premium UI
    const stats = [
        { label: 'Revenue Equipo', value: '$45,200', change: '+12.5%', icon: DollarSign, color: 'text-emerald-500' },
        { label: 'Closings', value: '128', change: '+8%', icon: Target, color: 'text-primary' },
        { label: 'Set Rate', value: '42%', change: '-2%', icon: Zap, color: 'text-amber-500' },
        { label: 'Team Active', value: '12/15', icon: Users, color: 'text-indigo-500' },
    ];

    const teamActivity = [
        { name: 'Alex Rivera', role: 'Closer', status: 'In Call', performance: 92 },
        { name: 'Elena Gomez', role: 'Setter', status: 'Online', performance: 88 },
        { name: 'Marco Polo', role: 'Closer', status: 'Offline', performance: 45 },
    ];

    return (
        <div className="h-screen overflow-hidden relative bg-main">
            <motion.div
                className="absolute top-0 left-0 w-full h-[200%]"
                animate={{ y: `-${activeSection * 50}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                {/* SECTION 0: OVERVIEW */}
                <div className="absolute top-0 left-0 w-full h-[50%] p-8 overflow-y-auto custom-scrollbar">
                    <header className="flex justify-between items-end mb-10">
                        <div>
                            <h1 className="text-5xl font-black italic tracking-tighter text-base leading-none">
                                Sales Portal
                            </h1>
                            <p className="text-[10px] font-black tracking-[0.3em] text-muted mt-2 uppercase">
                                Admin Overview & Team Performance
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-6 py-3 bg-surface border border-base rounded-2xl flex items-center gap-3">
                                <Calendar size={16} className="text-primary" />
                                <span className="text-[10px] font-bold tracking-widest text-muted">FEBRERO 2026</span>
                            </div>
                        </div>
                    </header>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {stats.map((stat, idx) => (
                            <Card key={idx} variant="surface" className="p-8 relative overflow-hidden group hover:border-primary/30 transition-all">
                                <div className={`p-3 rounded-2xl bg-surface border border-base w-fit ${stat.color} mb-6`}>
                                    <stat.icon size={20} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-muted tracking-widest uppercase">{stat.label}</p>
                                    <h3 className="text-3xl font-black italic tracking-tighter text-base">{stat.value}</h3>
                                </div>
                                {stat.change && (
                                    <div className={`absolute top-8 right-8 text-[9px] font-black px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {stat.change}
                                    </div>
                                )}
                                <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                                    <stat.icon size={120} />
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <Card variant="surface" className="p-8 flex flex-col justify-center items-center text-center space-y-4">
                            <div className="p-4 bg-primary/10 rounded-full text-primary">
                                <TrendingUp size={32} />
                            </div>
                            <h3 className="text-xl font-black italic tracking-tighter">Growth Metrics</h3>
                            <p className="text-xs text-muted font-bold uppercase tracking-widest">Revisa el crecimiento mensual del equipo</p>
                            <Button variant="outline" className="mt-4" onClick={() => setActiveSection(1)}>Ver Detalles</Button>
                        </Card>
                        <Card variant="surface" className="p-8 flex flex-col justify-center items-center text-center space-y-4">
                            <div className="p-4 bg-amber-500/10 rounded-full text-amber-500">
                                <Activity size={32} />
                            </div>
                            <h3 className="text-xl font-black italic tracking-tighter">Live Activity</h3>
                            <p className="text-xs text-muted font-bold uppercase tracking-widest">Monitoreo en tiempo real de llamadas</p>
                        </Card>
                        <Card
                            variant="surface"
                            onClick={() => navigate('/sales-admin/team')}
                            className="p-8 group hover:bg-primary transition-all duration-500 cursor-pointer overflow-hidden relative"
                        >
                            <div className="relative z-10 space-y-2 text-left">
                                <h3 className="text-xl font-black italic tracking-tighter group-hover:text-white transition-colors">Team Builder</h3>
                                <p className="text-[10px] font-bold text-muted uppercase group-hover:text-white/60 transition-colors">AÑADIR NUEVO MIEMBRO</p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-20 transition-opacity">
                                <Users size={120} />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* SECTION 1: PERFORMANCE DETAILS */}
                <div className="absolute top-[50%] left-0 w-full h-[50%] p-8 overflow-y-auto custom-scrollbar">
                    <header className="mb-10">
                        <h2 className="text-4xl font-black italic tracking-tighter text-base uppercase">Rendimiento del Equipo</h2>
                        <p className="text-[10px] font-black tracking-[0.3em] text-muted mt-2 uppercase">Detailed Performance Analytics</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card variant="surface" className="lg:col-span-2 p-8 space-y-8">
                            <div className="flex justify-between items-center border-b border-base pb-6">
                                <div className="flex items-center gap-3">
                                    <Activity size={18} className="text-primary" />
                                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase">KPIs por Miembro</h3>
                                </div>
                                <button
                                    onClick={() => navigate('/sales-admin/team')}
                                    className="text-[9px] font-black tracking-widest text-primary hover:underline"
                                >
                                    GESTIONAR EQUIPO
                                </button>
                            </div>

                            <div className="space-y-4">
                                {teamActivity.map((member, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-main border border-base rounded-2xl group hover:border-primary/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-surface border border-base flex items-center justify-center font-black text-lg">
                                                {member.name[0]}
                                            </div>
                                            <div>
                                                <p className="font-black italic text-base tracking-tight">{member.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="neutral" className="bg-accent/10 text-accent text-[8px]">{member.role}</Badge>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'Offline' ? 'bg-muted' : 'bg-emerald-500'}`} />
                                                        <span className="text-[9px] font-bold text-muted uppercase">{member.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-[9px] font-black text-muted tracking-widest uppercase">KPI SCORE</p>
                                            <div className="flex items-center gap-4">
                                                <div className="w-32 h-1.5 bg-surface rounded-full overflow-hidden border border-base">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${member.performance}%` }}
                                                        className={`h-full ${member.performance > 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : member.performance > 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                    />
                                                </div>
                                                <span className="text-sm font-black italic text-base">{member.performance}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card variant="surface" className="p-8 bg-blue-600/5 border-blue-600/20">
                            <div className="flex items-center gap-3 mb-6">
                                <Zap size={18} className="text-primary" />
                                <h3 className="text-[11px] font-black tracking-[0.2em] uppercase">Alertas de Performance</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-main/50 p-4 rounded-2xl border border-blue-600/10 space-y-2">
                                    <p className="text-[10px] font-black text-primary tracking-widest">BAJA CONVERSIÓN</p>
                                    <p className="text-xs font-bold text-muted leading-relaxed">
                                        Marco ha caído por debajo del umbral del 15%.
                                    </p>
                                </div>
                                <div className="bg-main/50 p-4 rounded-2xl border border-blue-600/10 space-y-2">
                                    <p className="text-[10px] font-black text-primary tracking-widest">REVISIÓN PENDIENTE</p>
                                    <p className="text-xs font-bold text-muted leading-relaxed">
                                        Elena requiere revisión de su primer reporte.
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full mt-6 text-[10px] font-black uppercase" onClick={() => setActiveSection(0)}>Volver al Inicio</Button>
                        </Card>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SalesAdminDashboard;
