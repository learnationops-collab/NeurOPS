import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import api from '../../services/api';

const BuscadorGlobalDeck = ({ onSelectLead, role = 'setter' }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    // Cierre al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounce Search
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        const delay = setTimeout(async () => {
            setLoading(true);
            try {
                const endpoint = role === 'setter' ? '/setter/deck/search' : '/closer/deck/search';
                const res = await api.get(`${endpoint}?q=${encodeURIComponent(query)}`);
                setResults(res.data);
                setOpen(true);
            } catch (err) {
                console.error("Error buscando leads:", err);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(delay);
    }, [query, role]);

    const handleSelect = (leadId) => {
        onSelectLead(leadId);
        setQuery('');
        setResults([]);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-md mx-auto z-[999]">
            <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-xl transition-all focus-within:border-violet-500/50">
                <Search size={16} className="text-slate-500 mr-2" />
                <input
                    type="text"
                    placeholder="Búsqueda global (Nombre, IG, Email...)"
                    className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder-slate-500"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                />
                {loading && <Loader2 size={14} className="text-violet-500 animate-spin ml-2" />}
            </div>

            {/* Panel de Autocompletado */}
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="divide-y divide-slate-800/50">
                        {results.map((r) => (
                            <button
                                key={r.id}
                                onClick={() => handleSelect(r.id)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors flex items-center justify-between"
                            >
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-white">{r.lead_name}</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase">Agenda ID: {r.id} • {new Date(r.start_time).toLocaleDateString()}</p>
                                </div>
                                
                                {/* Insignias de procesamiento */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {r.setter_processed ? (
                                        <span className="text-[8px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Setter OK</span>
                                    ) : (
                                        <span className="text-[8px] font-black uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Triage</span>
                                    )}
                                    {r.closer_processed && (
                                        <span className="text-[8px] font-black uppercase bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full">Win</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {open && query.trim().length >= 2 && results.length === 0 && !loading && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-2xl">
                    No se encontraron coincidencias
                </div>
            )}
        </div>
    );
};

export default BuscadorGlobalDeck;
