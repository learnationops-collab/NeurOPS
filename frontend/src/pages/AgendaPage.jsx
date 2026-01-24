import { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, Clock, PhoneIncoming, MessageSquare, ArrowRight } from 'lucide-react';

const AgendaPage = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const res = await api.get('/api/closer/leads');
            setLeads(res.data.leads);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Cargando agenda...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">Mi Agenda</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Clientes Asignados y Seguimientos</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leads.map(lead => (
                    <div key={lead.id} className="bg-slate-900/60 p-6 rounded-[2rem] border border-slate-800 hover:border-slate-700 transition-all group cursor-pointer relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xl ring-1 ring-indigo-500/20">
                                {lead.username[0].toUpperCase()}
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${lead.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                {lead.status}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-white font-black text-lg">{lead.username}</h3>
                                <p className="text-xs text-slate-500 font-medium">{lead.email}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-800/50 flex gap-4">
                                <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all">
                                    <PhoneIncoming size={16} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Llamar</span>
                                </button>
                                <button className="flex-1 py-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-500 hover:text-white rounded-xl flex items-center justify-center gap-2 transition-all">
                                    <MessageSquare size={16} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
                                </button>
                            </div>
                        </div>

                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={20} className="text-indigo-500" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgendaPage;
