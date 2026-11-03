import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock,
    Target, Trash2, Trophy, Star, FileText, AlertTriangle, DollarSign, Info,
} from 'lucide-react';
import api from '../../../../services/api';
import { BANDERA, href, MODALIDAD } from '../lib/escalas';
import { VEREDICTO } from './comun';
import { ContactoFicha, Seccion } from './SeccionesFicha';

// Los siete veredictos que puede poner un revisor. 'baja' pide motivo: es la
// única que describe algo que pasó DESPUÉS de seleccionar/hacer entrar a
// prueba a alguien, y conviene dejarlo escrito.
const ACCIONES = [
    { id: 'seleccionada', label: 'Seleccionar', icon: CheckCircle2, fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    { id: 'en_reserva', label: 'Reserva', icon: Clock, fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    { id: 'testeo', label: 'Pasar a prueba', icon: Target, fg: '#D9A441', bg: '#1A171C', bd: '#473924' },
    { id: 'winner', label: 'Winner', icon: Trophy, fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    { id: 'top_tier', label: 'Top tier', icon: Star, fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    { id: 'descartado', label: 'Descartar', icon: XCircle, fg: 'rgba(255,255,255,.82)', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.38)' },
    { id: 'baja', label: 'Baja', icon: Trash2, fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
];

// Qué botones se ven según el veredicto actual — ya no son siempre los 5/7:
// cada estado tiene un siguiente paso lógico, no todos a la vez.
const ACCIONES_POR_VEREDICTO = {
    sin_analizar: ['seleccionada', 'en_reserva', 'descartado'],
    // Una incompleta o una que cortó el formulario igual se puede rescatar: aprobarla o pasarla
    // directo a prueba (Winners). Lo pidió Kerwin el 08/10/2026 para quien no terminó el
    // formulario pero vale la pena.
    incompleta: ['seleccionada', 'en_reserva', 'testeo', 'descartado'],
    seleccionada: ['testeo', 'en_reserva', 'descartado'],
    en_reserva: ['seleccionada', 'descartado'],
    // Descartada: rescatarla, o (si la descartó un revisor) tocar «Descartar» de nuevo para
    // deshacerlo. Si la cortó el formulario no hay nada que deshacer: ver `botonesDe`.
    descartado: ['seleccionada', 'en_reserva', 'testeo', 'descartado'],
    // En prueba: cerrarla (Winner / Top tier / Baja) o devolverla a Análisis si no era el
    // momento. Lo pidió Kerwin el 09/10/2026: no había forma de sacarla de prueba.
    testeo: ['seleccionada', 'en_reserva', 'winner', 'top_tier', 'baja'],
    // Winner y Top tier también tienen vuelta: a prueba o a Análisis, y se pasa de una a la
    // otra sin volver a prueba (Kerwin, 09/10/2026).
    winner: ['seleccionada', 'en_reserva', 'testeo', 'top_tier', 'baja'],
    top_tier: ['seleccionada', 'en_reserva', 'testeo', 'winner', 'baja'],
    baja: [], // terminal: ya se fue, no hay a dónde moverlo
};

/** Los botones de decisión de una postulación. A una descartada por el formulario (sin
 * veredicto de un revisor) no se le ofrece «Descartar»: ya lo está, y tocarlo solo la
 * convertiría en un descarte manual. */
export const botonesDe = (d) => ACCIONES.filter((a) => {
    if (!(ACCIONES_POR_VEREDICTO[d.veredicto] || []).includes(a.id)) return false;
    return !(d.veredicto === 'descartado' && a.id === 'descartado' && d.estado !== 'descartado');
});

// El icono que acompaña al veredicto en la cabecera.
const ICONO_VEREDICTO = {
    sin_analizar: Info,
    incompleta: AlertTriangle,
    seleccionada: CheckCircle2,
    en_reserva: Clock,
    testeo: Target,
    winner: Trophy,
    top_tier: Star,
    descartado: XCircle,
    baja: Trash2,
};

// --- Tamaño del panel ---

// El panel usa casi toda la pantalla (hasta 1600px de ancho, con un margen del
// 2% del alto) y lo diseñado entra sin scrollear en 1404 x 864 de panel (un
// monitor de 1440 x 900). En pantallas más grandes no se estira el espacio en
// blanco: todo el contenido se agranda en bloque (`zoom`) hasta llenar el panel,
// así el texto crece con el monitor. En pantallas bajas o angostas va a pantalla
// completa y sin escalar.
const BASE_ANCHO = 1404;
const BASE_ALTO = 864;
const ESCALA_MAX = 1.35;

export const dimensionesPanel = (ancho, alto) => {
    if (ancho < 640 || alto < 681) return null;
    const margen = Math.round(alto * 0.02);
    const w = Math.min(ancho - margen * 2, 1600);
    const h = alto - margen * 2;
    const zoom = Math.max(1, Math.min(w / BASE_ANCHO, h / BASE_ALTO, ESCALA_MAX));
    return { zoom, width: Math.floor(w / zoom), height: Math.floor(h / zoom) };
};

const useDimensionesPanel = () => {
    const leer = () => (typeof window === 'undefined' ? null : dimensionesPanel(window.innerWidth, window.innerHeight));
    const [dim, setDim] = useState(leer);
    useEffect(() => {
        const onResize = () => setDim(leer());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return dim;
};

// --- Piezas chicas ---

const BOTON_CABECERA = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-[13.5px] font-bold transition-all';
const PILDORA = `${BOTON_CABECERA} px-3`;
const PILDORA_NEUTRA = `${PILDORA} border-white/[.32] bg-white/[.04] hover:bg-[#5B7CFF]/20`;
const BOTON_ICONO = 'flex h-10 w-10 flex-none items-center justify-center rounded-[11px] border border-white/[.32] bg-white/[.04] transition-all hover:bg-[#5B7CFF]/20 disabled:opacity-30';

// Las etiquetas en mayúsculas van en <small>: el reset tipográfico global
// (index.html) pisa el peso y el tracking de span/div/button/h*, pero no el de
// <small> — el mismo truco que ya usa el encabezado del panel.
const Etiqueta = ({ children, className = '' }) => (
    <small className={`block text-[11px] font-extrabold uppercase leading-none tracking-[.08em] text-white/45 ${className}`}>
        {children}
    </small>
);

// Qué tan completo quedó el formulario del registro. El número lo calcula el
// backend (`completitud`, entero 0-100); acá solo se dibuja. Sin dato, nada.
export const colorCompletitud = (pct) => (pct >= 100 ? '#2FBF8F' : pct >= 50 ? '#D9A441' : '#E85C4A');

export const Completitud = ({ valor }) => {
    const n = typeof valor === 'number' ? valor : (valor == null || valor === '' ? NaN : Number(valor));
    if (!Number.isFinite(n)) return null;
    const pct = Math.max(0, Math.min(100, Math.round(n)));
    const color = colorCompletitud(pct);
    return (
        <span
            className="flex w-[190px] flex-none flex-col justify-center gap-1.5 px-1"
            data-testid="completitud"
            title="Qué parte del formulario completó la persona"
        >
            <span className="whitespace-nowrap text-[13px] font-bold leading-none text-white/65">
                Formulario completo al <span className="tabular-nums" style={{ color }}>{pct} %</span>
            </span>
            <span
                role="progressbar"
                aria-label="Formulario completo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="block h-1.5 w-full overflow-hidden rounded-full bg-white/[.12]"
            >
                <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
            </span>
        </span>
    );
};

const HiringCandidateModal = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fallo, setFallo] = useState(false);
    const [abiertas, setAbiertas] = useState(new Set());
    const [todasAbiertas, setTodasAbiertas] = useState(false);
    const [bajaAbierta, setBajaAbierta] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [copiado, setCopiado] = useState(null);
    const cuerpo = useRef(null);
    const dim = useDimensionesPanel();

    // Al navegar rápido (flechas, auto-avance) puede haber dos pedidos en vuelo:
    // si el de la postulación anterior llega tarde, no debe pisar a la actual —
    // los botones de decisión actúan sobre `applicationId`, no sobre lo que se ve.
    const idVigente = useRef(applicationId);
    useEffect(() => { idVigente.current = applicationId; }, [applicationId]);

    const cargar = useCallback(async (id) => {
        setLoading(true);
        setFallo(false);
        try {
            const res = await api.get(`/assistant-applications/${id}`);
            if (id === idVigente.current) setData(res.data);
        } catch (err) {
            console.error('Error al cargar la postulación:', err);
            if (id === idVigente.current) setFallo(true);
        } finally {
            if (id === idVigente.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (applicationId) cargar(applicationId);
        // Nada de la postulación anterior queda en pantalla mientras carga la
        // siguiente: la cabecera con el nombre de una y el pie de otra confunde.
        setData(null);
        setAbiertas(new Set());
        setTodasAbiertas(false);
        setBajaAbierta(false);
        setMotivo('');
        cuerpo.current?.scrollTo({ top: 0 });
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
        // Tocar de nuevo el mismo botón activo lo deshace (vuelve a null) — eso
        // no es "avanzar a la próxima decisión", es corregir la actual, así que
        // no dispara el auto-avance.
        const esUndo = data?.estado === valor && !motivoTexto;
        try {
            await api.post(`/assistant-applications/${applicationId}/estado`, {
                valor: esUndo ? null : valor,
                motivo: motivoTexto || null,
            });
            setBajaAbierta(false);
            setMotivo('');
            onDecidido?.();
            // Auto-avance: decidido el veredicto, se salta sola a la siguiente
            // postulación de la lista para poder despachar en cadena, igual que
            // pidió Kerwin en la grabación. Si era la última, se queda mostrando
            // esta (ya actualizada).
            if (!esUndo && idx < ids.length - 1) {
                siguiente();
            } else {
                await cargar(applicationId);
            }
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
    const cargando = loading && !data;
    const cvHref = href(d.cv);
    const veredicto = VEREDICTO[d.veredicto] || VEREDICTO.sin_analizar;
    const IconoVeredicto = ICONO_VEREDICTO[d.veredicto] || Info;
    const ubicacion = [[d.pais, d.provincia].filter(Boolean).join(' - '), d.edad && `${d.edad} años`].filter(Boolean).join(' · ') || '—';

    const secciones = d.secciones || [];
    const conTextoLargo = secciones.some((s) => s.preguntas.some((p) => p.valor != null && (p.tipo === 'parrafo' || String(p.valor).length > 90)));
    const botones = botonesDe(d);
    const estadoTexto = [
        d.revisado_por && `Decidió ${d.revisado_por}`,
        d.estado_motivo,
        copiado && `${copiado} copiado`,
    ].filter(Boolean).join(' · ');

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/80 p-0 backdrop-blur-sm [@media(min-width:640px)_and_(min-height:681px)]:p-[2vh]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
        >
            {/* El diálogo ocupa casi toda la pantalla y mide siempre lo mismo, venga
                la postulación que venga (ver `dimensionesPanel`); en las pantallas
                bajas —un notebook chico— va a pantalla completa, sin margen ni
                bordes redondeados, para que todo entre sin scrollear. */}
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={d.nombre ? `Postulación de ${d.nombre}` : 'Postulación'}
                className={`flex flex-col overflow-hidden ${dim ? '' : 'h-full w-full'} border-white/[.12] bg-[#0B0F26] shadow-2xl [@media(min-width:640px)_and_(min-height:681px)]:rounded-[24px] [@media(min-width:640px)_and_(min-height:681px)]:border`}
                style={dim ? { zoom: dim.zoom, width: dim.width, height: dim.height } : undefined}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Cabecera fija: identidad a la izquierda; acceso rápido al video, al
                    CV, el veredicto, lo que pide y el score a la derecha. */}
                <header className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-white/10 bg-[#020617]/95 px-5 py-2.5 sm:px-6">
                    <div className="flex min-w-0 flex-1 basis-[280px] items-center gap-3.5">
                        <span
                            className="grid h-11 w-11 flex-none place-items-center rounded-[13px] text-[20px] font-black"
                            style={{ background: 'linear-gradient(135deg,#1323C6,#5B7CFF)' }}
                        >
                            {(d.nombre || '?')[0]}
                        </span>
                        <div className="min-w-0">
                            <span className="mb-1 flex items-center gap-2">
                                <small className="block text-[11px] font-extrabold uppercase leading-none tracking-[.18em] text-[#FF3FA4]">Postulación</small>
                                {d.modalidad && (
                                    <span
                                        className="flex-none rounded-full border px-2 py-[2px] text-[10px] font-black uppercase leading-none tracking-[.1em]"
                                        style={{ color: MODALIDAD[d.modalidad]?.fg, borderColor: MODALIDAD[d.modalidad]?.bd, background: MODALIDAD[d.modalidad]?.bg }}
                                    >
                                        {MODALIDAD[d.modalidad]?.label}
                                    </span>
                                )}
                            </span>
                            <h2 className="truncate text-[26px] font-black leading-[1.1] tracking-tight" title={d.nombre || undefined}>{d.nombre || '—'}</h2>
                            <span className="mt-1 flex items-center gap-2.5 text-[13.5px] leading-none text-white/55">
                                <span className="h-3.5 w-5 flex-none rounded-[3px]" style={{ background: BANDERA[d.pais] || 'rgba(255,255,255,.2)' }} />
                                <span className="min-w-0 truncate">{ubicacion}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                        {!cargando && !fallo && (
                            <>
                                {cvHref && (
                                    <a href={cvHref} target="_blank" rel="noreferrer" className={PILDORA_NEUTRA}>
                                        <FileText size={17} /> CV
                                    </a>
                                )}
                                <span className={`${PILDORA} border`} style={{ color: veredicto.fg, background: veredicto.bg, borderColor: veredicto.bd }}>
                                    <IconoVeredicto size={16} /> {veredicto.label}
                                </span>
                                {d.remuneracion && <span className={`${PILDORA} gap-2 border-[#5B7CFF]/50 bg-[#1323C6]/[.14]`}>
                                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-[#8AA3FF]/60 text-[#8AA3FF]">
                                        <DollarSign size={13} strokeWidth={2.6} />
                                    </span>
                                    <span className="text-[19px] font-black tabular-nums" style={{ color: Number(d.remuneracion) > 400 ? '#FF6AD5' : '#fff' }}>
                                        {d.remuneracion || '—'}
                                    </span>
                                    <Etiqueta>USD / mes</Etiqueta>
                                </span>}
                                <span className={`${PILDORA} gap-2 border-white/[.32] bg-white/[.04]`}>
                                    <Etiqueta>Score</Etiqueta>
                                    <span className="text-[20px] font-black tabular-nums" style={{ color: d.score >= 85 ? '#5B7CFF' : '#fff' }}>
                                        {d.score ?? '—'}
                                    </span>
                                </span>
                                <Completitud valor={d.completitud} />
                            </>
                        )}

                        <span className="flex flex-none items-center gap-1.5">
                            <button type="button" onClick={anterior} disabled={idx <= 0} aria-label="Anterior" className={BOTON_ICONO}>
                                <ChevronLeft size={19} />
                            </button>
                            {idx >= 0 && (
                                <span className="min-w-[36px] text-center text-[13px] font-bold tabular-nums text-white/50">{idx + 1}/{ids.length}</span>
                            )}
                            <button type="button" onClick={siguiente} disabled={idx >= ids.length - 1} aria-label="Siguiente" className={BOTON_ICONO}>
                                <ChevronRight size={19} />
                            </button>
                            <button type="button" onClick={onClose} aria-label="Cerrar" className={`${BOTON_ICONO} ml-1`}>
                                <X size={19} />
                            </button>
                        </span>
                    </div>
                </header>

                {/* Cuerpo: lo único que puede scrollear, y solo si la pantalla es
                    más chica que la postulación. */}
                <div ref={cuerpo} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {cargando && <div className="px-7 py-24 text-center text-[16px] text-white/40">Cargando la postulación…</div>}
                    {fallo && !data && <div className="px-7 py-24 text-center text-[16px] text-[#E85C4A]">No se pudo cargar la postulación.</div>}

                    {data && (
                        <motion.div
                            key={applicationId}
                            className="flex w-full flex-col gap-3 px-5 py-3 sm:px-6"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16 }}
                        >
                            {(d.descartado || d.auto_ko) && (
                                <div className="flex items-start gap-3 rounded-2xl border border-[#4C2227] bg-[#1B0F1D] px-4 py-3">
                                    <AlertTriangle size={19} className="mt-px flex-none text-[#E85C4A]" />
                                    <span className="text-[14px] leading-snug text-white/60">
                                        <span className="font-bold text-[#E85C4A]">El formulario cortó esta postulación · </span>
                                        {d.motivo_descarte || 'Una respuesta excluyente cortó el formulario. Está marcada abajo con «Corta».'}
                                        {!d.estado && ' · Si igual vale la pena, abajo podés seleccionarla o pasarla a prueba.'}
                                    </span>
                                </div>
                            )}

                            <div className="grid items-start gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                                <div className="lg:sticky lg:top-0">
                                    <ContactoFicha d={d} onCopiar={copiar} />
                                </div>
                                <div className="min-w-0">
                                    {conTextoLargo && (
                                        <div className="flex justify-end pb-2">
                                            <button
                                                type="button"
                                                onClick={() => { setTodasAbiertas((v) => !v); setAbiertas(new Set()); }}
                                                className="inline-flex h-8 items-center gap-2 rounded-xl border border-white/[.2] bg-white/[.04] px-3.5 text-[12.5px] font-bold text-white/75 transition-all hover:bg-[#5B7CFF]/20 hover:text-white"
                                            >
                                                {todasAbiertas ? 'Cerrar las respuestas escritas' : 'Abrir las respuestas escritas'}
                                                <ChevronDown size={14} className="transition-transform duration-200" style={{ transform: todasAbiertas ? 'rotate(180deg)' : 'none' }} />
                                            </button>
                                        </div>
                                    )}
                                    {secciones.length === 0 && (
                                        <span className="block py-4 text-[14px] text-white/35">Todavía no hay respuestas para revisar.</span>
                                    )}
                                    <div className="gap-3 xl:columns-2">
                                        {secciones.map((s, k) => (
                                            <Seccion key={`${s.titulo}-${k}`} s={s} abiertas={abiertas} todasAbiertas={todasAbiertas} onToggle={toggle} onCopiar={copiar} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Barra de decisión, fija abajo: el veredicto se pone sin scrollear.
                    Deja libre el costado derecho, donde flota el botón global de
                    reportar un problema. */}
                {data && (
                    <footer className="flex-none border-t border-white/10 bg-[#020617]/95 px-5 py-2.5 pr-[156px] sm:px-6 sm:pr-[168px]">
                        {bajaAbierta ? (
                            <div className="flex flex-wrap items-center justify-end gap-3">
                                <span className="text-[14.5px] font-bold text-white/70">Motivo de la baja de {d.nombre}:</span>
                                <input
                                    type="text"
                                    autoFocus
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Por qué se fue…"
                                    className="h-11 min-w-[240px] flex-1 rounded-xl border border-white/[.38] bg-black/30 px-4 text-[14.5px] text-white outline-none focus:border-[#5B7CFF]"
                                />
                                <button
                                    type="button"
                                    disabled={motivo.trim().length < 4}
                                    onClick={() => decidir('baja', motivo.trim())}
                                    className="h-11 rounded-xl border border-[#4C2227] px-5 text-[14px] font-black transition-all disabled:opacity-50"
                                    style={motivo.trim().length >= 4
                                        ? { background: '#E85C4A', color: '#1B0808' }
                                        : { background: 'transparent', color: '#E85C4A' }}
                                >
                                    Confirmar baja
                                </button>
                                <button type="button" onClick={() => { setBajaAbierta(false); setMotivo(''); }} className="px-1 text-[14px] font-bold text-white/50 hover:text-white">
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2.5">
                                {estadoTexto && (
                                    <span className="mr-auto min-w-0 truncate text-[13.5px] font-semibold text-white/45">{estadoTexto}</span>
                                )}
                                {botones.map((a) => {
                                    const activo = d.estado === a.id;
                                    return (
                                        <motion.button
                                            key={a.id}
                                            type="button"
                                            onClick={() => (a.id === 'baja' && !activo ? setBajaAbierta(true) : decidir(a.id))}
                                            whileHover={{ y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                            transition={{ duration: 0.12 }}
                                            className="flex h-10 items-center gap-2.5 rounded-xl border px-5 text-[14.5px] font-bold"
                                            style={{
                                                borderColor: a.bd,
                                                background: activo ? a.fg : a.bg,
                                                color: activo ? '#0B0F26' : a.fg,
                                            }}
                                            title={activo ? 'Tocar otra vez lo deshace' : a.label}
                                        >
                                            <a.icon size={18} /> {a.label}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}
                    </footer>
                )}
            </motion.div>
        </motion.div>
    );
};

export default HiringCandidateModal;
