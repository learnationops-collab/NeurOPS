import React, { useEffect, useState, useCallback } from 'react';
import {
    X, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock,
    Target, Trash2, Video, FileText, Mail, MessageCircle, AlertTriangle, Copy,
} from 'lucide-react';
import api from '../../../../services/api';
import {
    PREGUNTA_CORTA, CAMPOS_LARGOS, VAL_CORTO, AREA_CORTO,
    escalaDe, nivelDe, techoIA, nivelCorto, BANDERA, soloDigitos, href,
} from '../lib/escalas';
import { Dots, Chip } from './HiringInbox';

// Los cinco veredictos que puede poner un revisor. 'baja' pide motivo: es la
// única que describe algo que pasó DESPUÉS de contratar y conviene dejarlo
// escrito.
const ACCIONES = [
    { id: 'seleccionada', label: 'Seleccionar', icon: CheckCircle2, fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    { id: 'en_reserva', label: 'Reserva', icon: Clock, fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    { id: 'testeo', label: 'Testeo', icon: Target, fg: '#D9A441', bg: '#1A171C', bd: '#473924' },
    { id: 'descartado', label: 'Descartar', icon: XCircle, fg: 'rgba(255,255,255,.82)', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.38)' },
    { id: 'baja', label: 'Baja', icon: Trash2, fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
];

// Los 4 excluyentes + la verificación de comprensión: son lo primero que mira
// un revisor, así que van en un riel propio arriba en vez de perdidos dentro
// del bloque Requisitos.
const REQUISITOS = [
    ['equipo', (v) => /^S[íi]/.test(v || '')],
    ['disponibilidad', (v) => /4 horas ahora/.test(v || '')],
    ['horario', (v) => /^S[íi]/.test(v || '')],
    ['empleo', (v) => /^No/.test(v || '')],
    ['confirma', (v) => /4 horas diarias y desde el tercer mes/.test(v || '')],
];

// Cada fila del riel de experiencia: escala 0-4 + etiqueta corta.
const EXPERIENCIA = ['experiencia', 'digital', 'remoto', 'dinero', 'pm', 'educacion'];

// Herramientas con nivel medible, para el riel de stack.
const STACK = [
    ['sheets', 'Google Sheets', null],
    ['ia_nivel', 'ChatGPT · Claude', null],
    ['meta', 'Meta Ads', 'meta'],
    ['notion', 'Notion', 'notion'],
    ['wa_tools', 'WhatsApp', 'wa_tools'],
    ['automatizaciones', 'Zapier y análogas', 'automatizaciones'],
];

const Riel = ({ titulo, children }) => (
    <div className="flex flex-col rounded-[20px] border border-white/[.09] bg-white/[.035] px-4 pb-3.5 pt-1.5">
        <span className="flex items-center gap-2 py-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/45">
            {titulo}
        </span>
        {children}
    </div>
);

const Fila = ({ k, children, title }) => (
    <div className="flex min-w-0 items-center gap-3 border-t border-white/[.07] py-3" title={title}>
        <span className="w-[74px] flex-none text-[9.5px] font-extrabold uppercase leading-snug tracking-[.13em] text-white/40">{k}</span>
        <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug">{children}</span>
    </div>
);

const HiringCandidateModal = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [abiertas, setAbiertas] = useState(new Set());
    const [todasAbiertas, setTodasAbiertas] = useState(false);
    const [bajaAbierta, setBajaAbierta] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [copiado, setCopiado] = useState(null);

    const cargar = useCallback(async (id) => {
        setLoading(true);
        try {
            const res = await api.get(`/assistant-applications/${id}`);
            setData(res.data);
        } catch (err) {
            console.error('Error al cargar la postulación:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (applicationId) cargar(applicationId);
        setAbiertas(new Set());
        setTodasAbiertas(false);
        setBajaAbierta(false);
        setMotivo('');
    }, [applicationId, cargar]);

    const idx = ids.indexOf(applicationId);
    const anterior = () => idx > 0 && onNavigate(ids[idx - 1]);
    const siguiente = () => idx < ids.length - 1 && onNavigate(ids[idx + 1]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') anterior();
            if (e.key === 'ArrowRight') siguiente();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }); // sin deps: `idx` cambia en cada render de navegación

    if (!applicationId) return null;

    const decidir = async (valor, motivoTexto) => {
        try {
            await api.post(`/assistant-applications/${applicationId}/estado`, {
                valor: data?.estado === valor && !motivoTexto ? null : valor,
                motivo: motivoTexto || null,
            });
            setBajaAbierta(false);
            setMotivo('');
            await cargar(applicationId);
            onDecidido?.();
        } catch (err) {
            console.error('Error al guardar el veredicto:', err);
        }
    };

    const copiar = (texto, etiqueta) => {
        navigator.clipboard?.writeText(String(texto || '')).finally(() => {
            setCopiado(etiqueta);
            setTimeout(() => setCopiado(null), 1800);
        });
    };

    const toggle = (campo) => setAbiertas((prev) => {
        const next = new Set(prev);
        next.has(campo) ? next.delete(campo) : next.add(campo);
        setTodasAbiertas(false);
        return next;
    });

    const d = data || {};
    const digitos = soloDigitos(d.whatsapp);
    const ia = techoIA(d.ia_avanzado);
    const videoHref = href(d.video);
    const cvHref = href(d.cv);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#020617]/80 px-3 py-6 backdrop-blur-sm sm:px-6"
            onClick={onClose}
        >
            <div
                className="w-full max-w-[1560px] overflow-hidden rounded-[28px] border border-white/[.12] bg-[#0B0F26] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabecera: identidad, veredicto, score y navegación entre candidatas */}
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-white/10 bg-[#020617]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <span
                            className="grid h-11 w-11 flex-none place-items-center rounded-2xl text-[18px] font-black"
                            style={{ background: 'linear-gradient(135deg,#1323C6,#FF3FA4)' }}
                        >
                            {(d.nombre || '?')[0]}
                        </span>
                        <div className="min-w-0">
                            <h2 className="truncate text-[20px] font-black leading-tight tracking-tight">{d.nombre || '—'}</h2>
                            <span className="mt-1 flex items-center gap-2 text-[12px] text-white/50">
                                <span className="h-2.5 w-3.5 flex-none rounded-[2px]" style={{ background: BANDERA[d.pais] || 'rgba(255,255,255,.2)' }} />
                                {[d.pais, d.edad && `${d.edad} años`].filter(Boolean).join(' · ') || '—'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-none items-center gap-4">
                        <Chip veredicto={d.veredicto} />
                        <span className="flex flex-col items-end leading-none">
                            <span className="text-[26px] font-black tabular-nums" style={{ color: d.score >= 85 ? '#5B7CFF' : '#fff' }}>
                                {d.score ?? '—'}
                            </span>
                            <span className="mt-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-white/40">Score</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <button type="button" onClick={anterior} disabled={idx <= 0} aria-label="Anterior" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.38] bg-white/5 transition-all hover:bg-[#5B7CFF]/20 disabled:opacity-30">
                                <ChevronLeft size={17} />
                            </button>
                            <button type="button" onClick={siguiente} disabled={idx >= ids.length - 1} aria-label="Siguiente" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.38] bg-white/5 transition-all hover:bg-[#5B7CFF]/20 disabled:opacity-30">
                                <ChevronRight size={17} />
                            </button>
                            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.38] bg-white/5 transition-all hover:bg-[#5B7CFF]/20">
                                <X size={17} />
                            </button>
                        </span>
                    </div>
                </div>

                {loading && <div className="px-7 py-20 text-center text-white/40">Cargando la postulación…</div>}

                {!loading && (
                    <div className="flex flex-col gap-5 px-5 py-6 sm:px-7">
                        {(d.descartado || d.auto_ko) && (
                            <div className="flex items-start gap-3 rounded-2xl border border-[#4C2227] bg-[#1B0F1D] px-5 py-4">
                                <AlertTriangle size={18} className="mt-0.5 flex-none text-[#E85C4A]" />
                                <div>
                                    <span className="block text-[13.5px] font-bold text-[#E85C4A]">
                                        El formulario cortó esta postulación
                                    </span>
                                    <span className="mt-1 block text-[12.5px] leading-relaxed text-white/55">
                                        {d.motivo_descarte || 'Una respuesta del bloque Requisitos es excluyente. No llegó a completar el resto.'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Rieles: requisitos, contacto y material, experiencia, stack */}
                        <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-4">
                            <Riel titulo="Requisitos">
                                {REQUISITOS.map(([campo, ok]) => {
                                    const valor = d[campo];
                                    const pasa = ok(valor);
                                    return (
                                        <Fila key={campo} k={PREGUNTA_CORTA[campo]} title={valor || 'Sin respuesta'}>
                                            <span className="flex items-start gap-2">
                                                {valor
                                                    ? (pasa
                                                        ? <CheckCircle2 size={14} className="mt-0.5 flex-none text-[#2FBF8F]" />
                                                        : <AlertTriangle size={14} className="mt-0.5 flex-none text-[#D9A441]" />)
                                                    : <XCircle size={14} className="mt-0.5 flex-none text-white/25" />}
                                                <span className={valor ? '' : 'text-white/35'}>
                                                    {VAL_CORTO[valor] || valor || 'Sin respuesta'}
                                                </span>
                                            </span>
                                        </Fila>
                                    );
                                })}
                            </Riel>

                            <Riel titulo="Contacto y material">
                                <Fila k="Pide">
                                    <span className="text-[17px] font-black tabular-nums" style={{ color: Number(d.remuneracion) > 400 ? '#FF6AD5' : '#fff' }}>
                                        {d.remuneracion ? `${d.remuneracion} USD` : '—'}
                                    </span>
                                    <span className="ml-1.5 text-[11px] font-semibold text-white/40">por mes</span>
                                </Fila>
                                <Fila k="Correo">
                                    {d.email ? (
                                        <button type="button" onClick={() => copiar(d.email, 'correo')} className="flex w-full items-center gap-2 text-left hover:text-white">
                                            <Mail size={13} className="flex-none text-white/45" />
                                            <span className="truncate">{d.email}</span>
                                            <Copy size={12} className="flex-none text-white/30" />
                                        </button>
                                    ) : <span className="text-white/35">Sin correo</span>}
                                </Fila>
                                <Fila k="WhatsApp">
                                    {digitos ? (
                                        <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 tabular-nums hover:text-[#25D366]">
                                            <MessageCircle size={13} className="flex-none text-white/45" />
                                            {d.whatsapp}
                                        </a>
                                    ) : <span className="text-white/35">Sin WhatsApp</span>}
                                </Fila>
                                <Fila k="Video">
                                    <span className="flex flex-wrap items-center gap-2">
                                        {videoHref ? (
                                            <a href={videoHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/[.38] bg-white/5 px-3 py-1.5 text-[11.5px] hover:bg-[#5B7CFF]/20">
                                                <Video size={13} /> Abrir video
                                            </a>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4C2227] bg-[#1B0F1D] px-3 py-1.5 text-[11.5px] text-[#E85C4A]">
                                                <Video size={13} /> Sin video
                                            </span>
                                        )}
                                        {videoHref && !d.video_ok && (
                                            <span className="text-[10.5px] font-bold text-[#FF6AD5]">Sin verificar</span>
                                        )}
                                    </span>
                                </Fila>
                                <Fila k="CV">
                                    {cvHref ? (
                                        <a href={cvHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/[.38] bg-white/5 px-3 py-1.5 text-[11.5px] hover:bg-[#5B7CFF]/20">
                                            <FileText size={13} /> Abrir CV
                                        </a>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4C2227] bg-[#1B0F1D] px-3 py-1.5 text-[11.5px] text-[#E85C4A]">
                                            <FileText size={13} /> Sin CV
                                        </span>
                                    )}
                                </Fila>
                            </Riel>

                            <Riel titulo="Experiencia">
                                {EXPERIENCIA.map((campo) => {
                                    const e = escalaDe(campo, d[campo]);
                                    return (
                                        <Fila key={campo} k={PREGUNTA_CORTA[campo]} title={d[campo] || 'Sin respuesta'}>
                                            <span className="block">{e.label}</span>
                                            <span className="mt-1.5 block"><Dots n={e.n} /></span>
                                        </Fila>
                                    );
                                })}
                                <Fila k={PREGUNTA_CORTA.area} title={d.area || ''}>
                                    <span className="text-white/80">{AREA_CORTO[d.area] || d.area || '—'}</span>
                                </Fila>
                            </Riel>

                            <Riel titulo="Idiomas y herramientas">
                                <Fila k="Inglés" title={d.ingles || ''}>
                                    <span className="block">{d.ingles || '—'}</span>
                                    <span className="mt-1.5 block"><Dots n={nivelDe(d.ingles)} /></span>
                                </Fila>
                                <Fila k={d.pais === 'Brasil' ? 'Español' : 'Portugués'} title={d.idioma2 || ''}>
                                    <span className="block">{d.idioma2 || '—'}</span>
                                    <span className="mt-1.5 block"><Dots n={nivelDe(d.idioma2)} /></span>
                                </Fila>
                                {STACK.map(([campo, nombre, escala]) => {
                                    const e = escala ? escalaDe(escala, d[campo]) : { n: nivelDe(d[campo]), label: nivelCorto(d[campo]) };
                                    return (
                                        <Fila key={campo} k={nombre} title={d[campo] || 'Sin respuesta'}>
                                            <span className="block" style={{ color: e.n > 0 ? '#fff' : 'rgba(255,255,255,.45)' }}>{e.label}</span>
                                            <span className="mt-1.5 block"><Dots n={e.n} color="#2FBF8F" /></span>
                                        </Fila>
                                    );
                                })}
                                <Fila k={PREGUNTA_CORTA.ia_avanzado} title={d.ia_avanzado || ''}>
                                    <span className="block" style={{ color: ia.n >= 3 ? '#8AA3FF' : '#fff' }}>{ia.label}</span>
                                    <span className="mt-1.5 block"><Dots n={ia.n} /></span>
                                </Fila>
                            </Riel>
                        </div>

                        {/* Las 41 respuestas, agrupadas en los 9 bloques que el propio
                            backend devuelve (`bloques`), en el mismo orden en que las
                            contestó la candidata. */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <span className="text-[11.5px] font-extrabold uppercase tracking-[.16em] text-white/50">
                                Respuestas completas · {d.respondidas}/{d.total_preguntas}
                            </span>
                            <button
                                type="button"
                                onClick={() => { setTodasAbiertas((v) => !v); setAbiertas(new Set()); }}
                                className="rounded-full border border-white/[.38] bg-white/5 px-4 py-2 text-[12px] font-bold transition-all hover:bg-[#5B7CFF]/20"
                            >
                                {todasAbiertas ? 'Cerrar las respuestas largas' : 'Abrir todas las respuestas'}
                            </button>
                        </div>

                        {(d.bloques || []).map((bloque) => (
                            <div key={bloque.titulo} className="rounded-[20px] border border-white/[.09] bg-white/[.035] px-4 pb-4 pt-1 sm:px-5">
                                <span className="flex items-center gap-2 py-3.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/45">
                                    {bloque.titulo}
                                    <span className="text-white/25">· {bloque.campos.length}</span>
                                </span>
                                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                                    {bloque.campos.map((campo) => {
                                        const valor = d[campo];
                                        const esLargo = CAMPOS_LARGOS.has(campo);
                                        const abierta = todasAbiertas || abiertas.has(campo);
                                        const texto = valor == null || valor === '' ? null : String(valor);
                                        const preview = texto && texto.length > 110 && !abierta ? `${texto.slice(0, 110)}…` : texto;
                                        return (
                                            <div
                                                key={campo}
                                                className={`flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/[.11] bg-white/[.045] px-5 py-4 transition-all hover:border-[#5B7CFF]/45 hover:bg-[#5B7CFF]/[.07] ${esLargo ? 'col-span-full' : ''}`}
                                            >
                                                <span className="text-[10.5px] font-extrabold uppercase tracking-[.14em] text-white/40">
                                                    {PREGUNTA_CORTA[campo] || campo}
                                                </span>
                                                {esLargo ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => texto && toggle(campo)}
                                                        className="flex w-full items-start gap-3 text-left"
                                                    >
                                                        <span
                                                            className="min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed"
                                                            style={{ color: texto ? '#fff' : '#E85C4A' }}
                                                        >
                                                            {preview || '— sin respuesta'}
                                                        </span>
                                                        {texto && (
                                                            <ChevronDown
                                                                size={17}
                                                                className="mt-0.5 flex-none text-white/35 transition-transform"
                                                                style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}
                                                            />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="whitespace-pre-wrap break-words text-[13.5px] font-semibold leading-snug"
                                                        style={{ color: texto ? '#fff' : '#E85C4A' }}
                                                    >
                                                        {texto || '— sin respuesta'}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Barra de decisión, pegada abajo: el veredicto se pone sin scrollear
                    hasta el final de 41 respuestas. */}
                {!loading && (
                    <div className="sticky bottom-0 border-t border-white/10 bg-[#020617]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
                        {bajaAbierta ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[12.5px] font-bold text-white/70">Motivo de la baja de {d.nombre}:</span>
                                <input
                                    type="text"
                                    autoFocus
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Por qué se fue…"
                                    className="min-w-[220px] flex-1 rounded-2xl border border-white/[.38] bg-black/30 px-4 py-3 text-[13.5px] text-white outline-none focus:border-[#5B7CFF]"
                                />
                                <button
                                    type="button"
                                    disabled={motivo.trim().length < 4}
                                    onClick={() => decidir('baja', motivo.trim())}
                                    className="rounded-full border border-[#4C2227] px-5 py-3 text-[12.5px] font-black transition-all disabled:opacity-50"
                                    style={motivo.trim().length >= 4
                                        ? { background: '#E85C4A', color: '#1B0808' }
                                        : { background: 'transparent', color: '#E85C4A' }}
                                >
                                    Confirmar baja
                                </button>
                                <button type="button" onClick={() => { setBajaAbierta(false); setMotivo(''); }} className="text-[12.5px] font-bold text-white/50 hover:text-white">
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2.5">
                                {ACCIONES.map((a) => {
                                    const activo = d.estado === a.id;
                                    return (
                                        <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => (a.id === 'baja' && !activo ? setBajaAbierta(true) : decidir(a.id))}
                                            className="flex items-center gap-2 rounded-full border px-5 py-3 text-[12.5px] font-black transition-all hover:-translate-y-0.5"
                                            style={{
                                                borderColor: a.bd,
                                                background: activo ? a.fg : a.bg,
                                                color: activo ? '#0B0F26' : a.fg,
                                            }}
                                            title={activo ? 'Tocar otra vez lo deshace' : a.label}
                                        >
                                            <a.icon size={15} /> {a.label}
                                        </button>
                                    );
                                })}
                                <span className="ml-auto text-[11.5px] font-semibold text-white/40">
                                    {d.revisado_por ? `Decidió ${d.revisado_por}` : 'Sin decidir'}
                                    {d.estado_motivo ? ` · ${d.estado_motivo}` : ''}
                                    {copiado ? ` · ${copiado} copiado` : ''}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HiringCandidateModal;
