import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    Search,
    Filter,
    MoreHorizontal,
    ShieldCheck,
    UserPlus,
    BarChart3,
    Clock,
    Mail,
    Phone
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

const TeamManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const team = [
        { id: 1, name: 'Alex Rivera', role: 'Closer', email: 'alex@learnation.com', status: 'Active', joined: 'Oct 2025', team: 'Squad A' },
        { id: 2, name: 'Elena Gomez', role: 'Setter', email: 'elena@learnation.com', status: 'Active', joined: 'Jan 2026', team: 'Squad B' },
        { id: 3, name: 'Marco Polo', role: 'Closer', email: 'marco@learnation.com', status: 'Inactive', joined: 'Dec 2025', team: 'Squad A' },
        { id: 4, name: 'Sofia Loren', role: 'Closer', email: 'sofia@learnation.com', status: 'Active', joined: 'Feb 2026', team: 'Squad C' },
    ];

    const filteredTeam = team.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 space-y-10"
        >
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black italic tracking-tighter text-base leading-none uppercase">
                        Gestión de Equipo
                    </h1>
                    <p className="text-[10px] font-black tracking-[0.3em] text-muted mt-2 uppercase">
                        Supervisión y Administración de Closers y Setters
                    </p>
                </div>
                <Button variant="primary" className="h-14 px-8 text-xs font-black tracking-[0.2em]" icon={UserPlus}>
                    AÑADIR MIEMBRO
                </Button>
            </header>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Search & Filters */}
                <Card variant="surface" className="flex-1 p-4 flex items-center gap-4 border-white/5">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o rol..."
                            className="w-full bg-main/50 border border-base rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-primary/50 font-bold transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="h-14 w-14 flex items-center justify-center bg-surface border border-base rounded-2xl text-muted hover:text-primary transition-all">
                        <Filter size={18} />
                    </button>
                </Card>

                {/* Quick Summary Cards */}
                <div className="flex gap-4">
                    <Card variant="surface" className="px-6 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Users size={18} />
                        </div>
                        <div>
                            <p className="text-[20px] font-black italic leading-none">{team.length}</p>
                            <p className="text-[8px] font-black tracking-widest text-muted uppercase">MIEMBROS</p>
                        </div>
                    </Card>
                    <Card variant="surface" className="px-6 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <p className="text-[20px] font-black italic leading-none">3</p>
                            <p className="text-[8px] font-black tracking-widest text-muted uppercase">ACTIVOS HOY</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Team Table */}
            <Card variant="surface" className="overflow-hidden border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-surface/50 border-b border-base">
                            <tr>
                                <th className="px-8 py-6 text-[10px] font-black tracking-widest text-muted uppercase">Miembro</th>
                                <th className="px-8 py-6 text-[10px] font-black tracking-widest text-muted uppercase">Rol & Equipo</th>
                                <th className="px-8 py-6 text-[10px] font-black tracking-widest text-muted uppercase">Contacto</th>
                                <th className="px-8 py-6 text-[10px] font-black tracking-widest text-muted uppercase">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black tracking-widest text-muted uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base">
                            {filteredTeam.map((member) => (
                                <tr key={member.id} className="group hover:bg-surface/40 transition-all">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-main border border-base flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                                {member.name[0]}
                                            </div>
                                            <div>
                                                <p className="font-black italic text-base tracking-tight">{member.name}</p>
                                                <p className="text-[9px] font-bold text-muted uppercase">Se unió: {member.joined}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1.5">
                                            <Badge variant={member.role === 'Closer' ? 'primary' : 'accent'} className="text-[9px] font-black uppercase tracking-widest h-6 px-3">
                                                {member.role}
                                            </Badge>
                                            <p className="text-[10px] font-bold text-muted ml-1 italic">{member.team}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1 font-bold text-[11px] text-muted">
                                            <div className="flex items-center gap-2">
                                                <Mail size={12} className="text-primary/60" />
                                                <span>{member.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone size={12} className="text-primary/60" />
                                                <span>+34 000 000 000</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-muted'}`} />
                                            <span className="text-[10px] font-black tracking-widest uppercase">{member.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-primary hover:border-primary/30 transition-all">
                                                <BarChart3 size={16} />
                                            </button>
                                            <button className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-primary hover:border-primary/30 transition-all">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </motion.div>
    );
};

export default TeamManagement;
