import React from 'react';
import { Phone, Mail, Instagram, Clock, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const LeadRoadmapHeader = ({
    lead,
    data,
    compact,
    onBack,
    onShowEditModal,
    userRole,
    appointmentId,
    availableKeywords,
    fetchRoadmap,
    onUpdate
}) => {
    const statusColors = {
        "Ganado": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        "En proceso": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
        "Entrante": "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        "Perdido": "bg-rose-500/20 text-rose-400 border border-rose-500/30"
    };

    const getDaysSinceCreated = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const created = new Date(dateStr);
            const now = new Date();
            const diffTime = Math.abs(now - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return `${diffDays} d`;
        } catch {
            return 'N/A';
        }
    };

    const channel = lead.origin || "Instagram Ads";
    const setter = lead.setter || "Valentina";
    const closer = lead.closer || "Sin Closer";

    if (compact) {
        return (
            <div className="space-y-3 pb-3 border-b border-slate-900">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-white italic tracking-tight">{lead.full_name}</h2>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400">
                            {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                                    <Phone size={10} className="text-violet-500" /> {lead.phone}
                                </a>
                            )}
                            {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-white transition-colors">
                                    <Mail size={10} className="text-violet-500" /> {lead.email}
                                </a>
                            )}
                            {lead.instagram && (
                                <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
                                    <Instagram size={10} className="text-violet-500" /> @{lead.instagram}
                                </a>
                            )}
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${statusColors[lead.status] || 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                        {lead.status}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] bg-slate-900/30 p-3 rounded-xl border border-slate-850">
                    <div>
                        <span className="text-slate-500 block font-bold uppercase tracking-wider text-[8px]">Origen</span>
                        <span className="font-black text-violet-400">{channel}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block font-bold uppercase tracking-wider text-[8px]">Edad</span>
                        <span className="font-black text-white">{lead.created_at ? getDaysSinceCreated(lead.created_at) : 'N/A'}</span>
                    </div>
                    <div>
                        <span className="text-slate-500 block font-bold uppercase tracking-wider text-[8px]">Asignación</span>
                        <span className="font-black text-slate-300">
                            <span className="text-amber-500">{setter}</span> / <span className="text-emerald-400">{closer}</span>
                        </span>
                    </div>
                    <div>
                        <span className="text-slate-500 block font-bold uppercase tracking-wider text-[8px] mb-0.5">Anuncio (Keyword)</span>
                        <span className="font-black text-white">{lead.keyword || data?.appointment_keyword || 'Sin anuncio'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            ← Volver
                        </button>
                    )}
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Leads / <span className="text-slate-300">Lead Roadmap</span>
                    </div>
                </div>
                
                <button 
                    onClick={onShowEditModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                    <Edit size={12} /> Editar Lead
                </button>
            </div>

            <div className="flex flex-col lg:flex-row justify-between gap-6 p-2 mb-4">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-600/30 to-amber-600/10 rounded-2xl flex items-center justify-center text-violet-400 font-black text-2xl border border-violet-500/20 shadow-xl">
                        {lead.full_name ? lead.full_name.substring(0, 2).toUpperCase() : 'LD'}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none">{lead.full_name}</h2>
                            <span className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${statusColors[lead.status] || 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                {lead.status}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-400">
                            {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Phone size={12} className="text-violet-500" /> {lead.phone}
                                </a>
                            )}
                            {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Mail size={12} className="text-violet-500" /> {lead.email}
                                </a>
                            )}
                            {lead.instagram && (
                                <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Instagram size={12} className="text-violet-500" /> @{lead.instagram}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-8 items-center self-center w-full lg:w-auto mt-4 lg:mt-0">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origen</div>
                        <div className="text-xs font-black text-violet-400">{channel}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Anuncio (Keyword)</div>
                        <div className="text-xs font-black text-white">{lead.keyword || data?.appointment_keyword || 'Sin anuncio'}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asignación</div>
                        <div className="text-xs font-black text-white">
                            <span className="text-amber-500">{setter}</span> / <span className="text-emerald-400">{closer}</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edad</div>
                        <div className="text-xs font-black text-white flex items-center gap-1">
                            <Clock size={12} className="text-slate-500" />
                            {lead.created_at ? getDaysSinceCreated(lead.created_at) : 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadRoadmapHeader;
