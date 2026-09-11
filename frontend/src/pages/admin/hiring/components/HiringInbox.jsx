import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Inbox, Clock, CheckCircle2, XCircle, Target, Trash2, MessageCircle,
    ChevronRight, AlertTriangle,
} from 'lucide-react';
import api from '../../../../services/api';
import HiringCandidateModal from './HiringCandidateModal';
import {
    escalaDe, nivelDe, techoIA, BANDERA, soloDigitos,
} from '../lib/escalas';

// Sub-filtros por grupo. El `id` es directamente el valor de `filtro` que
// entiende GET /assistant-applications.
const SUBFILTROS = {
    pendientes: [
        { id: 'sin_analizar', label: 'Sin analizar', icon: Clock, color: '#D9A441' },
        { id: 'incompletas', label: 'Incompletas', icon: AlertTriangle, color: '#E85C4A' },
    ],
    analizados: [
        { id: 'seleccionadas', label: 'Seleccionadas', icon: CheckCircle2, color: '#2FBF8F' },
        { id: 'en_reserva', label: 'Reserva', icon: Clock, color: '#8AA3FF' },
        { id: 'testeo', label: 'Testeo', icon: Target, color: '#D9A441' },
        { id: 'descartadas', label: 'Descartadas', icon: XCircle, color: '#7F8CA8' },
        { id: 'bajas', label: 'Baja', icon: Trash2, color: '#E85C4A' },
    ],
};

export const VEREDICTO = {
    seleccionada: { label: 'Seleccionada', fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    en_reserva: { label: 'En reserva', fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    testeo: { label: 'En testeo', fg: '#D9A441', bg: '#1A171C', bd: '#473924' },
    descartado: { label: 'Descartada', fg: 'rgba(255,255,255,.82)', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.38)' },
    baja: { label: 'Baja', fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
    incompleta: { label: 'Incompleta', fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
    sin_analizar: { label: 'Sin analizar', fg: '#4E8BD8', bg: '#0A152C', bd: '#1A3155' },
};

/** Medidor de 4 puntitos: el nivel de una respuesta de un vistazo. */
export const Dots = ({ n, color = '#5B7CFF' }) => (
    <span className="flex gap-[3px]">
        {[1, 2, 3, 4].map((j) => (
            <span
                key={j}
                className="h-[5px] w-[9px] rounded-sm"
                style={{ background: j <= n ? color : 'rgba(255,255,255,.14)' }}
            />
        ))}
    </span>
);

export const Chip = ({ veredicto }) => {
    const v = VEREDICTO[veredicto] || VEREDICTO.sin_analizar;
    return (
        <span
            className="inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[.14em]"
            style={{ color: v.fg, background: v.bg, borderColor: v.bd }}
        >
            {v.label}
        </span>
    );
};

const MetricCard = ({ icon: Icon, n, label, color = '#fff', bg = 'rgba(255,255,255,.045)', bd = 'rgba(255,255,255,.12)' }) => (
    <div className="flex items-center gap-3.5 rounded-[18px] border px-5 py-4" style={{ background: bg, borderColor: bd }}>
        <Icon size={18} style={{ color }} />
        <span className="flex flex-col leading-none">
            <span className="text-2xl font-black tabular-nums" style={{ color }}>{n}</span>
            <span className="mt-1.5 text-[11.5px] font-bold text-white/50">{label}</span>
        </span>
    </div>
);

const AVATARES = [
    'linear-gradient(135deg,#1323C6,#5B7CFF)',
    'linear-gradient(135deg,#5B7CFF,#8AA3FF)',
    'linear-gradient(135deg,#1323C6,#FF3FA4)',
    'linear-gradient(135deg,#3D5AE0,#7A46D8)',
];

const HiringInbox = ({ grupo = 'pendientes', query = '', onConteos }) => {
    const subfiltros = SUBFILTROS[grupo] || [];
    const [sub, setSub] = useState(subfiltros[0]?.id || 'todas');
    const [postulaciones, setPostulaciones] = useState([]);
    const [conteos, setConteos] = useState({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);

    // Al cambiar de destino (Pendientes ↔ Analizados) se vuelve al primer
    // sub-filtro de ese grupo: mantener el anterior mostraría un filtro que ni
    // siquiera aparece en la fila de arriba.
    useEffect(() => { setSub(subfiltros[0]?.id || 'todas'); }, [grupo]); // eslint-disable-line react-hooks/exhaustive-deps

    // Buscar recorre todo el pool, no sólo la vista activa.
    const filtroEfectivo = grupo === 'busqueda' ? 'todas' : sub;

    const cargar = useCallback(async (f) => {
        setLoading(true);
        try {
            const res = await api.get(`/assistant-applications?filtro=${f}`);
            setPostulaciones(res.data.postulaciones);
            setConteos(res.data.conteos);
            setTotal(res.data.total);
        } catch (err) {
            console.error('Error al cargar postulaciones de Asistente:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(filtroEfectivo); }, [filtroEfectivo, cargar]);

    // Los badges del dock los mantiene el padre; se los pasamos al cargar.
    useEffect(() => {
        if (!onConteos || !conteos.todas) return;
        const analizados = (conteos.seleccionadas || 0) + (conteos.en_reserva || 0)
            + (conteos.testeo || 0) + (conteos.descartadas || 0) + (conteos.bajas || 0);
        onConteos({ pendientes: conteos.sin_analizar || 0, analizados });
    }, [conteos, onConteos]);

    const filas = useMemo(() => {
        if (!query) return postulaciones;
        const q = query.toLowerCase();
        return postulaciones.filter(
            (p) => (p.nombre || '').toLowerCase().includes(q) || (p.pais || '').toLowerCase().includes(q)
        );
    }, [postulaciones, query]);

    const ids = useMemo(() => filas.map((p) => p.id), [filas]);

    const onDecidido = () => cargar(filtroEfectivo);

    const analizadas = (conteos.seleccionadas || 0) + (conteos.en_reserva || 0)
        + (conteos.testeo || 0) + (conteos.descartadas || 0) + (conteos.bajas || 0);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <MetricCard icon={Inbox} n={total} label="Postulaciones" />
                <MetricCard icon={Clock} n={conteos.sin_analizar ?? 0} label="Sin analizar" color="#D9A441" />
                <MetricCard
                    icon={CheckCircle2}
                    n={analizadas}
                    label="Analizadas"
                    color="#8AA3FF"
                    bg="rgba(19,35,198,.18)"
                    bd="rgba(91,124,255,.42)"
                />
                <MetricCard icon={Target} n={conteos.con_video ?? 0} label="Con video verificado" color="#2FBF8F" bg="#071A24" bd="#10413D" />
            </div>

            {subfiltros.length > 0 && !query && (
                <div className="inline-flex max-w-full items-stretch gap-1 self-start overflow-x-auto rounded-[18px] border border-white/[.12] bg-white/[.045] p-1.5">
                    {subfiltros.map((f) => {
                        const activo = sub === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setSub(f.id)}
                                className={`flex h-11 flex-none items-center gap-2.5 whitespace-nowrap rounded-[14px] px-4 text-[13.5px] font-bold transition-all ${
                                    activo ? 'text-white' : 'text-white/60 hover:bg-[#5B7CFF]/10 hover:text-white'
                                }`}
                                style={activo ? { background: 'linear-gradient(100deg,#1323C6,#5B7CFF)', boxShadow: '0 8px 20px rgba(19,35,198,.42)' } : undefined}
                            >
                                <f.icon size={16} style={{ color: activo ? '#fff' : f.color }} />
                                <span>{f.label}</span>
                                <span className="tabular-nums" style={{ color: activo ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.38)' }}>
                                    {conteos[f.id] ?? 0}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="overflow-x-auto rounded-[24px] border border-white/[.12] bg-white/[.02]">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                    <thead>
                        <tr className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">
                            <th className="px-6 py-4">Candidata</th>
                            <th className="px-4 py-4">Pide</th>
                            <th className="px-4 py-4">Experiencia</th>
                            <th className="px-4 py-4">IA</th>
                            <th className="px-4 py-4">Sheets</th>
                            <th className="px-4 py-4">Idiomas</th>
                            <th className="px-3 py-4 text-center">Video</th>
                            <th className="px-3 py-4 text-center">CV</th>
                            <th className="px-4 py-4">WhatsApp</th>
                            <th className="px-4 py-4 text-right">Score</th>
                            <th className="px-4 py-4">Estado</th>
                            <th className="w-6 px-2 py-4" />
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && filas.map((p, i) => {
                            const exp = escalaDe('experiencia', p.experiencia);
                            const ia = techoIA(p.ia_avanzado);
                            const sheets = nivelDe(p.sheets);
                            const digitos = soloDigitos(p.whatsapp);
                            const pide = Number(String(p.remuneracion || '').replace(/[^\d]/g, '')) || 0;
                            return (
                                <tr
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className="cursor-pointer border-t border-white/[.075] text-[14px] transition-colors hover:bg-[#5B7CFF]/10"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[14px] font-black"
                                                style={{ background: AVATARES[i % AVATARES.length] }}
                                            >
                                                {(p.nombre || '?')[0]}
                                            </span>
                                            <span className="flex min-w-0 flex-col gap-1">
                                                <span className="truncate font-bold">{p.nombre}</span>
                                                <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                                                    <span
                                                        className="h-2.5 w-3.5 flex-none rounded-[2px]"
                                                        style={{ background: BANDERA[p.pais] || 'rgba(255,255,255,.2)' }}
                                                    />
                                                    {[p.pais, p.edad && `${p.edad} años`].filter(Boolean).join(' · ') || '—'}
                                                </span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="block font-bold tabular-nums" style={{ color: pide > 400 ? '#FF6AD5' : '#fff' }}>
                                            {pide ? `${pide} USD` : '—'}
                                        </span>
                                        <span className="mt-1.5 block h-[3px] w-full max-w-[72px] overflow-hidden rounded-full bg-white/10">
                                            <span
                                                className="block h-full rounded-full"
                                                style={{
                                                    width: `${Math.min(100, Math.round(pide / 5.2))}%`,
                                                    background: pide > 400
                                                        ? 'linear-gradient(90deg,#FF6AD5,#FF3FA4)'
                                                        : 'linear-gradient(90deg,#1323C6,#5B7CFF)',
                                                }}
                                            />
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-[12.5px] font-semibold text-white/75">{exp.label}</td>
                                    <td className="px-4 py-4" title={`Techo: ${p.ia_avanzado || '—'} · Nivel declarado: ${p.ia_nivel || '—'}`}>
                                        <span className="block text-[12.5px] font-bold" style={{ color: ia.n >= 3 ? '#8AA3FF' : ia.n === 0 ? 'rgba(255,255,255,.42)' : '#fff' }}>
                                            {ia.label}
                                        </span>
                                        <span className="mt-1.5 block"><Dots n={ia.n} /></span>
                                    </td>
                                    <td className="px-4 py-4" title={p.sheets || ''}>
                                        <Dots n={sheets} color="#2FBF8F" />
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="flex flex-col gap-1.5">
                                            <span className="flex items-center gap-2" title={`Inglés: ${p.ingles || '—'}`}>
                                                <span className="w-5 text-[9px] font-black tracking-wide text-white/40">EN</span>
                                                <Dots n={nivelDe(p.ingles)} />
                                            </span>
                                            <span className="flex items-center gap-2" title={`${p.pais === 'Brasil' ? 'Español' : 'Portugués'}: ${p.idioma2 || '—'}`}>
                                                <span className="w-5 text-[9px] font-black tracking-wide text-white/40">
                                                    {p.pais === 'Brasil' ? 'ES' : 'PT'}
                                                </span>
                                                <Dots n={nivelDe(p.idioma2)} />
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        {p.video_ok
                                            ? <CheckCircle2 size={17} className="mx-auto text-[#2FBF8F]" />
                                            : <XCircle size={17} className="mx-auto text-[#E85C4A]" />}
                                    </td>
                                    <td className="px-3 py-4 text-center">
                                        {p.cv
                                            ? <CheckCircle2 size={17} className="mx-auto text-[#2FBF8F]" />
                                            : <XCircle size={17} className="mx-auto text-[#E85C4A]" />}
                                    </td>
                                    <td className="px-4 py-4">
                                        {digitos ? (
                                            <a
                                                href={`https://wa.me/${digitos}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[11px] border border-white/[.12] bg-white/[.04] px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-white/70 transition-all hover:border-[#25D366] hover:bg-[#25D366]/15 hover:text-white"
                                            >
                                                <MessageCircle size={13} /> {p.whatsapp}
                                            </a>
                                        ) : (
                                            <span className="text-[11px] italic text-white/30">Sin WhatsApp</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-[19px] font-black tabular-nums" style={{ color: p.score >= 85 ? '#5B7CFF' : '#fff' }}>
                                            {p.score ?? '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Chip veredicto={p.veredicto} />
                                        {p.veredicto === 'descartado' && (
                                            <span className="mt-1.5 block text-[10px] font-bold text-white/40">
                                                {p.auto_ko || p.descartado ? 'Lo cortó el formulario' : 'Lo decidió un revisor'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-4">
                                        <ChevronRight size={16} className="text-white/25" />
                                    </td>
                                </tr>
                            );
                        })}
                        {loading && (
                            <tr><td colSpan={12} className="px-6 py-12 text-center text-white/40">Cargando…</td></tr>
                        )}
                        {!loading && filas.length === 0 && (
                            <tr>
                                <td colSpan={12} className="px-6 py-14 text-center">
                                    <span className="block text-[16px] font-bold text-white/70">
                                        {query ? 'Nadie coincide con esa búsqueda' : grupo === 'pendientes' ? 'No te queda nada acá' : 'Todavía nada en este estado'}
                                    </span>
                                    <span className="mt-1.5 block text-[13px] text-white/35">
                                        {query ? 'Probá con otro nombre o país.' : 'Cuando lleguen postulaciones nuevas aparecen en esta lista.'}
                                    </span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedId && (
                <HiringCandidateModal
                    applicationId={selectedId}
                    ids={ids}
                    onClose={() => setSelectedId(null)}
                    onNavigate={setSelectedId}
                    onDecidido={onDecidido}
                />
            )}
        </div>
    );
};

export default HiringInbox;
