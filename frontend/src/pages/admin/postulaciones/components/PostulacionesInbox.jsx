import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PostulacionDetailModal from './PostulacionDetailModal';
import PostulacionVoteToast from './PostulacionVoteToast';

const FILTROS = [
    { id: 'mis_pendientes', label: 'Mis pendientes' },
    { id: 'todas', label: 'Todas' },
    { id: 'preseleccionadas', label: 'Preseleccionadas' },
    { id: 'decidir', label: 'Decidir' },
    { id: 'descartadas', label: 'Descartadas' },
];

const VEREDICTO_BADGE = {
    preseleccionada: { label: 'Preseleccionada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    decidir: { label: 'Decidir', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    descartado: { label: 'Descartado', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
    sin_calificar: { label: 'Sin calificar', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

const PostulacionesInbox = () => {
    const { user } = useAuth();
    const [filtro, setFiltro] = useState('mis_pendientes');
    const [postulaciones, setPostulaciones] = useState([]);
    const [conteos, setConteos] = useState({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [toast, setToast] = useState(null);

    const cargar = useCallback(async (f) => {
        setLoading(true);
        try {
            const res = await api.get(`/job-applications?filtro=${f}`);
            setPostulaciones(res.data.postulaciones);
            setConteos(res.data.conteos);
            setTotal(res.data.total);
        } catch (err) {
            console.error('Error al cargar postulaciones:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(filtro); }, [filtro, cargar]);

    const ids = useMemo(() => postulaciones.map(p => p.id), [postulaciones]);
    const pendientes = conteos.mis_pendientes ?? 0;

    const irSiguiente = async () => {
        let lista = postulaciones;
        if (filtro !== 'mis_pendientes') {
            const res = await api.get('/job-applications?filtro=mis_pendientes');
            lista = res.data.postulaciones;
        }
        if (lista.length > 0) setSelectedId(lista[0].id);
    };

    const onVoted = (id, valor, veredicto) => {
        const postulacion = postulaciones.find(p => p.id === id);
        if (valor) {
            setToast({
                valor,
                nombre: postulacion?.nombre || '',
                mensajeFin: 'Actualizamos tu inbox de pendientes.',
            });
        }
        cargar(filtro);
        // Autoavance: si quedan otros pendientes, saltar al siguiente.
        if (valor) {
            setTimeout(async () => {
                const res = await api.get('/job-applications?filtro=mis_pendientes');
                const restante = res.data.postulaciones.find(p => p.id !== id);
                setSelectedId(restante ? restante.id : null);
            }, 250);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Postulaciones</span>
                    <span className="text-3xl font-black tracking-tight text-white">{total}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Completadas</span>
                    <span className="text-3xl font-black tracking-tight text-white">{total}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Con video y llamada</span>
                    <span className="text-3xl font-black tracking-tight text-white">{conteos.con_material ?? 0}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-pink-400/40 bg-gradient-to-br from-pink-500/20 to-blue-600/20 p-6">
                    <span className="text-[13px] text-white/70">A decidir entre los dos</span>
                    <span className="text-3xl font-black tracking-tight text-pink-300">{conteos.decidir ?? 0}</span>
                </div>
            </div>

            {/* Inbox card */}
            <div className="flex flex-wrap items-center gap-7 rounded-3xl border border-pink-400/30 bg-gradient-to-r from-blue-600/20 to-pink-500/15 px-7 py-6">
                <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/55">
                        Tu inbox · {user?.username}
                    </span>
                    <span className="text-xl font-black tracking-tight text-white">
                        Te faltan {pendientes} de {total} candidatos
                    </span>
                </div>
                <button
                    onClick={irSiguiente}
                    disabled={pendientes === 0}
                    className={`flex flex-none items-center gap-2 rounded-full bg-white px-7 py-4 text-[13px] font-black text-[#0B0F26] transition-transform hover:-translate-y-0.5 disabled:opacity-40 ${pendientes > 0 ? 'animate-pulse' : ''}`}
                >
                    Revisar el siguiente <ArrowRight size={16} />
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2.5">
                {FILTROS.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFiltro(f.id)}
                        className={`rounded-full border px-5 py-2.5 text-[13px] font-bold transition-all ${
                            filtro === f.id
                                ? 'border-pink-500 bg-pink-500/15 text-white'
                                : 'border-white/15 bg-white/[.03] text-white/70 hover:border-white/30'
                        }`}
                    >
                        {f.label} {typeof conteos[f.id] === 'number' ? `(${conteos[f.id]})` : ''}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto rounded-3xl border border-white/12">
                <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                            <th className="px-6 py-4">Candidato</th>
                            <th className="px-6 py-4 text-center">Formación</th>
                            <th className="px-6 py-4 text-center">Inglés</th>
                            <th className="px-6 py-4 text-center">Cierre</th>
                            <th className="px-6 py-4 text-center">Score</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && postulaciones.map(p => {
                            const badge = VEREDICTO_BADGE[p.veredicto] || VEREDICTO_BADGE.sin_calificar;
                            return (
                                <tr
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className="cursor-pointer border-b border-white/5 text-[14px] text-white transition-colors hover:bg-white/5"
                                >
                                    <td className="px-6 py-4 font-bold">{p.nombre}</td>
                                    <td className="px-6 py-4 text-center text-white/70">{p.conocimiento || '—'}</td>
                                    <td className="px-6 py-4 text-center font-variant-tabular text-white/70">{p.ingles || '—'}</td>
                                    <td className="px-6 py-4 text-center font-variant-tabular text-white/70">
                                        {p.cierre ? (p.cierre === 'nada' ? '—' : `${p.cierre} %`) : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-lg font-black text-pink-400">{p.score}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && postulaciones.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-white/40">No hay postulaciones en este filtro.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedId && (
                <PostulacionDetailModal
                    applicationId={selectedId}
                    currentUserId={user?.id}
                    ids={ids}
                    onClose={() => setSelectedId(null)}
                    onNavigate={setSelectedId}
                    onVoted={onVoted}
                />
            )}
            <PostulacionVoteToast toast={toast} onDone={() => setToast(null)} />
        </div>
    );
};

export default PostulacionesInbox;
