import { useState, useEffect } from 'react';
import api from '../../services/api';
import { User, Instagram, Mail } from 'lucide-react';

const SetterKanban = () => {
    const [stages, setStages] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stagesRes, leadsRes] = await Promise.all([
                    api.get('/setter/stages'),
                    api.get('/setter/leads')
                ]);
                setStages(stagesRes.data);
                setLeads(leadsRes.data);
            } catch (error) {
                console.error("Error fetching kanban data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getLeadsForStage = (stageId) => {
        return leads.filter(lead => lead.stage_id === stageId);
    };

    if (loading) return <div className="text-white">Cargando embudo...</div>;

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => (
                <div key={stage.id} className="min-w-[300px] bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col h-[600px]">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="font-bold text-slate-200 uppercase tracking-wider text-xs">{stage.name}</h3>
                        <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-full">
                            {getLeadsForStage(stage.id).length}
                        </span>
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {getLeadsForStage(stage.id).map(lead => (
                            <div key={lead.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-indigo-500/50 transition-colors cursor-pointer group">
                                <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-white text-sm line-clamp-1">{lead.name}</h4>
                                    {lead.instagram_username && (
                                        <a
                                            href={`https://instagram.com/${lead.instagram_username}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 text-slate-400 hover:text-pink-500 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="text-[10px] font-medium max-w-[80px] truncate">@{lead.instagram_username}</span>
                                            <Instagram size={14} />
                                        </a>
                                    )}
                                </div>

                                {lead.email && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                        <Mail size={12} />
                                        <span className="truncate">{lead.email}</span>
                                    </div>
                                )}

                                {/* Etiquetas y Anuncio */}
                                {(lead.tags?.length > 0 || lead.ad_source) && (
                                    <div className="flex flex-wrap gap-1 mb-2 mt-2">
                                        {lead.ad_source && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 truncate max-w-[150px]">
                                                📢 {lead.ad_source}
                                            </span>
                                        )}
                                        {lead.tags?.map((tag, idx) => (
                                            <span key={idx} className="px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 text-[10px]">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Comentario/Nota Inicial */}
                                {lead.notes && (
                                    <div className="bg-slate-700/30 p-2 rounded-lg mb-2 border border-slate-700">
                                        <p className="text-[10px] text-slate-300 italic line-clamp-2">" {lead.notes} "</p>
                                    </div>
                                )}

                                <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-2">
                                    <span className="text-[10px] text-slate-500 font-mono">
                                        {new Date(lead.created_at).toLocaleDateString()}
                                    </span>
                                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                                        Lead
                                    </span>
                                </div>
                            </div>
                        ))}

                        {getLeadsForStage(stage.id).length === 0 && (
                            <div className="text-center py-8 opacity-50">
                                <p className="text-xs text-slate-600 font-medium italic">Sin leads</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SetterKanban;
