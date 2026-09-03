import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';
import PostulacionDetailModal from './PostulacionDetailModal';

const VOTO_LABEL = { pre: 'Preseleccionó', res: 'Reservó', des: 'Descartó' };
const VOTO_CLS = {
    pre: 'bg-emerald-500/15 text-emerald-400',
    res: 'bg-amber-500/15 text-amber-400',
    des: 'bg-rose-500/15 text-rose-400',
};

const ReviewerCard = ({ r }) => {
    const alDia = r.faltan === 0;
    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-white/12 bg-white/[.04] p-6">
            <div className="flex items-center justify-between gap-3">
                <span className="text-[17px] font-black text-white">{r.nombre}</span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${alDia ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {alDia ? 'Al día' : 'Pendiente'}
                </span>
            </div>
            <div className="flex items-end gap-6">
                <div className="flex flex-col gap-0.5">
                    <span className={`text-5xl font-black leading-none tracking-tight ${alDia ? 'text-emerald-400' : 'text-pink-400'}`}>{r.faltan}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/45">le faltan</span>
                </div>
                <div className="flex flex-col gap-0.5 pb-1.5">
                    <span className="text-xl font-black text-white/75">{r.hechas}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">revisadas</span>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-pink-500 transition-all duration-700" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-right text-[11px] font-bold text-white/50">{r.pct}% completo</span>
            </div>
        </div>
    );
};

const CandidatoFila = ({ c, onSelect }) => (
    <div
        onClick={() => onSelect(c.id)}
        className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 transition-colors hover:bg-white/[.08]"
    >
        <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold text-white">{c.nombre}</span>
            <span className="text-[11px] text-white/45">score {c.score ?? '—'}</span>
        </div>
        {c.votos && (
            <div className="flex flex-wrap gap-2">
                {c.votos.map(v => (
                    <span key={v.reviewer_name} className={`rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap ${VOTO_CLS[v.vote] || 'bg-white/10 text-white/70'}`}>
                        {v.reviewer_name} · {VOTO_LABEL[v.vote] || v.vote}
                    </span>
                ))}
            </div>
        )}
    </div>
);

const ListaConVerMas = ({ items, onSelect, vacioTexto, limite = 5 }) => {
    const [expandido, setExpandido] = useState(false);
    const visibles = expandido ? items : items.slice(0, limite);
    return (
        <div className="flex flex-col gap-2.5">
            {items.length === 0 && <span className="text-[13px] text-white/50">{vacioTexto}</span>}
            {visibles.map(c => <CandidatoFila key={c.id} c={c} onSelect={onSelect} />)}
            {items.length > limite && (
                <button
                    onClick={() => setExpandido(s => !s)}
                    className="self-start rounded-full border border-white/18 px-4 py-2 text-[12px] font-bold text-white/75 transition-all hover:border-white/45 hover:text-white"
                >
                    {expandido ? 'Ver menos' : `Ver ${items.length - limite} más`}
                </button>
            )}
        </div>
    );
};

const Panel = ({ title, badge, children }) => (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/12 bg-white/[.04] p-6">
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-black text-white">{title}</span>
            {badge !== undefined && <span className="text-[11px] font-black uppercase tracking-widest text-pink-400">{badge}</span>}
        </div>
        {children}
    </div>
);

const PostulacionesRevisoresTab = () => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [selectedId, setSelectedId] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get('/job-applications/revisores');
            setData(res.data);
        } catch (err) {
            console.error('Error al cargar revisores:', err);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const ids = useMemo(() => {
        if (!data) return [];
        return [...data.desacuerdos.map(d => d.id), ...data.mis_pendientes.map(p => p.id)];
    }, [data]);

    const onVoted = () => cargar();

    if (!data) return <div className="py-10 text-center text-white/50">Cargando revisores...</div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <span className="text-lg font-black text-white">Estado de la revisión</span>
                <span className="text-[13px] text-white/55">Quién falta calificar y dónde no coincidimos, entre todos los que revisan.</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.revisores.map(r => <ReviewerCard key={r.id} r={r} />)}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Votaron distinto" badge={data.desacuerdos.length}>
                    <ListaConVerMas items={data.desacuerdos} onSelect={setSelectedId} vacioTexto="Coinciden en todo lo comparable." />
                </Panel>
                <Panel title={`Te falta ver · ${user?.username || ''}`} badge={data.mis_pendientes.length}>
                    <ListaConVerMas items={data.mis_pendientes} onSelect={setSelectedId} vacioTexto="Estás al día con lo que ya calificó el resto." />
                </Panel>
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
        </div>
    );
};

export default PostulacionesRevisoresTab;
