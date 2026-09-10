import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight, MessageCircle, Video, Phone } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PostulacionDetailModal from './PostulacionDetailModal';
import PostulacionVoteToast from './PostulacionVoteToast';

// Sub-filtros contextuales por grupo (pedido del usuario a partir de un mockup de
// referencia, 10/sep/2026): la pestaña inferior "Pendientes" solo ofrece "Sin analizar" y
// "Decidir"; "Analizados" agrupa todo lo que ya tiene un veredicto. El `id` de cada uno es
// directamente el valor de `filtro` que ya entiende `GET /job-applications` — "sin analizar"
// reusa el filtro `mis_pendientes` que ya existía (candidatos que este admin no votó todavía),
// solo cambia la etiqueta visible.
const SUBTABS_POR_GRUPO = {
    pend: [
        { id: 'mis_pendientes', label: 'Sin analizar' },
        { id: 'decidir', label: 'Decidir' },
    ],
    anal: [
        { id: 'preseleccionadas', label: 'Seleccionados' },
        { id: 'en_reserva', label: 'En reserva' },
        { id: 'testeo', label: 'Testeo' },
        { id: 'bajas', label: 'Baja' },
        { id: 'descartadas', label: 'Descartados' },
        { id: 'incompletas', label: 'Incompletos' },
    ],
};

const VEREDICTO_BADGE = {
    preseleccionada: { label: 'Seleccionado', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    en_reserva: { label: 'En reserva', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    decidir: { label: 'Decidir', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    testeo: { label: 'Testeo', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
    descartado: { label: 'Descartado', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
    baja: { label: 'De baja', cls: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20' },
    sin_calificar: { label: 'Sin calificar', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    incompleta: { label: 'Incompleta', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const soloDigitos = (texto) => (texto || '').replace(/\D/g, '');

const metaLinea = (p) => [p.pais, p.edad].filter(Boolean).join(' · ');

const PostulacionesInbox = ({ grupo = 'pend' }) => {
    const { user } = useAuth();
    const subtabs = SUBTABS_POR_GRUPO[grupo] || SUBTABS_POR_GRUPO.pend;
    const [sub, setSub] = useState(subtabs[0].id);
    const [postulaciones, setPostulaciones] = useState([]);
    const [conteos, setConteos] = useState({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [toast, setToast] = useState(null);

    // Al cambiar de grupo (pestaña inferior Pendientes <-> Analizados) se vuelve al primer
    // sub-filtro de ese grupo — mantener el `sub` anterior mostraría un filtro que ni
    // siquiera aparece en la fila de arriba.
    useEffect(() => { setSub(subtabs[0].id); }, [grupo]); // eslint-disable-line react-hooks/exhaustive-deps

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

    useEffect(() => { cargar(sub); }, [sub, cargar]);

    const ids = useMemo(() => postulaciones.map(p => p.id), [postulaciones]);
    const pendientes = conteos.mis_pendientes ?? 0;

    const irSiguiente = async () => {
        let lista = postulaciones;
        if (sub !== 'mis_pendientes') {
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
        cargar(sub);
        // Autoavance: si quedan otros pendientes, saltar al siguiente (solo tiene sentido
        // en el grupo "Pendientes" — en "Analizados" cada fila ya tiene veredicto).
        if (valor && grupo === 'pend') {
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

            {/* Sub-filtros: solo los del grupo activo (Pendientes o Analizados) */}
            <div className="flex flex-wrap gap-2.5">
                {subtabs.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSub(s.id)}
                        className={`rounded-full border px-5 py-2.5 text-[13px] font-bold transition-all ${
                            sub === s.id
                                ? 'border-pink-500 bg-pink-500/15 text-white'
                                : 'border-white/15 bg-white/[.03] text-white/70 hover:border-white/30'
                        }`}
                    >
                        {s.label} {typeof conteos[s.id] === 'number' ? `(${conteos[s.id]})` : ''}
                    </button>
                ))}
            </div>

            {grupo === 'pend' && (
                /* Inbox card: revisar el siguiente sin analizar, uno por uno */
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
            )}

            {sub !== 'incompletas' && (
                <div className="overflow-x-auto rounded-3xl border border-white/12">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                                <th className="px-6 py-4">Candidato</th>
                                <th className="px-6 py-4 text-center">Formación</th>
                                <th className="px-6 py-4 text-center">Inglés</th>
                                <th className="px-6 py-4 text-center">Cierre</th>
                                <th className="px-6 py-4 text-center">Progreso</th>
                                <th className="px-6 py-4 text-center">Score</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && postulaciones.map(p => {
                                const badge = p.completo
                                    ? (VEREDICTO_BADGE[p.veredicto] || VEREDICTO_BADGE.sin_calificar)
                                    : VEREDICTO_BADGE.incompleta;
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
                                        <td className="px-6 py-4 text-center font-variant-tabular text-white/70">
                                            {p.respondidas}/{p.total_preguntas}
                                        </td>
                                        <td className="px-6 py-4 text-center text-lg font-black text-pink-400">{p.score ?? '—'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && postulaciones.length === 0 && (
                                <tr><td colSpan={7} className="px-6 py-10 text-center text-white/40">No hay postulaciones en este filtro.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {sub === 'incompletas' && (
                <>
                    <p className="max-w-3xl text-[14px] leading-relaxed text-white/55">
                        Guardaron la postulación pero no la enviaron. Tenés su WhatsApp y su correo para empujarlas: son las que ya invirtieron tiempo y se cayeron en el camino.
                    </p>
                    <div className="overflow-x-auto rounded-3xl border border-white/12">
                        <table className="w-full min-w-[820px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                                    <th className="px-6 py-4">Candidato</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4">Avance</th>
                                    <th className="px-6 py-4">Materiales</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && postulaciones.map(p => {
                                    const pct = Math.round((p.respondidas / p.total_preguntas) * 100);
                                    const digitos = soloDigitos(p.whatsapp);
                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => setSelectedId(p.id)}
                                            className="cursor-pointer border-b border-white/5 text-[14px] text-white transition-colors hover:bg-white/5 align-top"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold">{p.nombre}</span>
                                                    {metaLinea(p) && <span className="text-[12px] text-white/50">{metaLinea(p)}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-2">
                                                    {digitos ? (
                                                        <a
                                                            href={`https://wa.me/${digitos}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                                                        >
                                                            <MessageCircle size={13} /> {p.whatsapp}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[12px] italic text-white/35">Sin WhatsApp</span>
                                                    )}
                                                    {p.email ? (
                                                        <a
                                                            href={`mailto:${p.email}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-fit text-[12px] font-semibold text-white/65 hover:text-pink-300 hover:underline"
                                                        >
                                                            {p.email}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[12px] italic text-white/35">Sin correo</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1.5 w-40">
                                                    <span className="text-[12px] font-bold text-white/70">
                                                        {p.respondidas}/{p.total_preguntas} · {pct}%
                                                    </span>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-pink-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.video ? (
                                                        <a
                                                            href={p.video}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                                                        >
                                                            <Video size={13} /> Ver video
                                                        </a>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/35">
                                                            <Video size={13} /> Sin video
                                                        </span>
                                                    )}
                                                    {p.llamada ? (
                                                        <a
                                                            href={p.llamada}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                                                        >
                                                            <Phone size={13} /> Ver llamada
                                                        </a>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/35">
                                                            <Phone size={13} /> Sin llamada
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && postulaciones.length === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-10 text-center text-white/40">No hay postulaciones incompletas.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

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
