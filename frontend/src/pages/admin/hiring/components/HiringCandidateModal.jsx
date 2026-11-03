import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Copy, Check,
    Target, Trash2, Trophy, Star, FileText, AlertTriangle, MessageCircle,
} from 'lucide-react';
import api from '../../../../services/api';
import { Aura } from '../../../../components/standard';
import { href, soloDigitos } from '../lib/escalas';
import { Seccion, repartir } from './SeccionesFicha';
import PanelDecision from './PanelDecision';
import './fichaPostulacion.css';

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

// Una cápsula de contacto de la cabecera: el dato y el botón de copiarlo.
const Capsula = ({ valor, etiqueta, copiado, onCopiar, children }) => (
    <div className="tl-fi-capsula">
        <span title={valor}>{children || valor}</span>
        <button type="button" className={`tl-fi-ibtn${copiado ? ' is-hecho' : ''}`} onClick={() => onCopiar(valor, etiqueta)}
            aria-label={`Copiar ${etiqueta}`} title={copiado ? 'Copiado' : `Copiar ${etiqueta}`}>
            {copiado ? <Check size={16} /> : <Copy size={16} />}
        </button>
    </div>
);

const HiringCandidateModal = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fallo, setFallo] = useState(false);
    const [abiertas, setAbiertas] = useState(new Set());
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
        // Nada de la postulación anterior queda en pantalla mientras carga la siguiente.
        setData(null);
        setAbiertas(new Set());
        cuerpo.current?.scrollTo({ top: 0 });
    }, [applicationId, cargar]);

    const idx = ids.indexOf(applicationId);
    const anterior = () => idx > 0 && onNavigate(ids[idx - 1]);
    const siguiente = () => idx < ids.length - 1 && onNavigate(ids[idx + 1]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.target?.tagName === 'INPUT') return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') anterior();
            if (e.key === 'ArrowRight') siguiente();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }); // sin deps: `idx` cambia en cada render de navegación

    if (!applicationId) return null;

    const decidir = async (valor, motivoTexto) => {
        // Tocar de nuevo el mismo botón activo lo deshace (vuelve a null): es
        // corregir la decisión actual, así que no dispara el auto-avance.
        const esUndo = data?.estado === valor && !motivoTexto;
        try {
            await api.post(`/assistant-applications/${applicationId}/estado`, {
                valor: esUndo ? null : valor,
                motivo: motivoTexto || null,
            });
            onDecidido?.();
            // Auto-avance: decidido el veredicto, salta a la siguiente de la lista
            // para despachar en cadena. Si era la última, se queda en esta.
            if (!esUndo && idx < ids.length - 1) siguiente();
            else await cargar(applicationId);
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
        if (next.has(campo)) next.delete(campo);
        else next.add(campo);
        return next;
    });

    const d = data || {};
    const cvHref = href(d.cv);
    const digitos = soloDigitos(d.whatsapp);
    const secciones = d.secciones || [];
    const titulos = secciones.map((s) => s.titulo);
    // {id de pregunta: {puntos, maximo, peso}} para mostrar lo que suma cada una.
    const puntos = Object.fromEntries((d.puntaje || []).map((r) => [r.id, r]));
    const columnas = repartir(secciones);
    const nota = [d.revisado_por && `Decidió ${d.revisado_por}`, d.estado_motivo].filter(Boolean).join(' · ');

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/80 p-0 backdrop-blur-sm [@media(min-width:640px)_and_(min-height:681px)]:p-[2vh]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
        >
            {/* Mide siempre lo mismo, venga la postulación que venga (ver
                `dimensionesPanel`); en pantallas bajas va a pantalla completa. */}
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={d.nombre ? `Postulación de ${d.nombre}` : 'Postulación'}
                className={`tl-fi ${dim ? '' : 'h-full w-full'} shadow-2xl [@media(min-width:640px)_and_(min-height:681px)]:rounded-[24px] [@media(min-width:640px)_and_(min-height:681px)]:border [@media(min-width:640px)_and_(min-height:681px)]:border-white/[.15]`}
                style={dim ? { zoom: dim.zoom, width: dim.width, height: dim.height } : undefined}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
                <header className="tl-fi-cab">
                    <Aura size="hero" colors={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--info)']} />
                    <h2 className="tl-fi-nombre" title={d.nombre || undefined}>{d.nombre || (loading ? 'Cargando…' : '—')}</h2>
                    <div className="tl-fi-acc">
                        {d.email && <Capsula valor={d.email} etiqueta="correo" copiado={copiado === 'correo'} onCopiar={copiar} />}
                        {d.whatsapp && (
                            <Capsula valor={d.whatsapp} etiqueta="WhatsApp" copiado={copiado === 'WhatsApp'} onCopiar={copiar}>
                                {digitos ? (
                                    <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp">
                                        <MessageCircle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} aria-hidden="true" />
                                        {d.whatsapp}
                                    </a>
                                ) : d.whatsapp}
                            </Capsula>
                        )}
                        {cvHref && (
                            <a className="tl-fi-cv" href={cvHref} target="_blank" rel="noreferrer">
                                <Aura soft colors={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--info)']} />
                                <FileText size={15} aria-hidden="true" /> Abrir CV
                            </a>
                        )}
                        <span className="tl-fi-sep" aria-hidden="true" />
                        <div className="tl-fi-nav">
                            <button type="button" className="tl-fi-ibtn" onClick={anterior} disabled={idx <= 0} aria-label="Anterior"><ChevronLeft size={18} /></button>
                            {idx >= 0 && <b>{idx + 1} / {ids.length}</b>}
                            <button type="button" className="tl-fi-ibtn" onClick={siguiente} disabled={idx >= ids.length - 1} aria-label="Siguiente"><ChevronRight size={18} /></button>
                        </div>
                        <button type="button" className="tl-fi-ibtn tl-fi-ibtn--borde" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
                    </div>
                </header>

                <div ref={cuerpo} className="tl-fi-cuerpo custom-scrollbar">
                    {!data && (
                        <div className="tl-fi-vacio" style={fallo ? { color: 'var(--error)' } : undefined}>
                            {fallo ? 'No se pudo cargar la postulación.' : 'Cargando la postulación…'}
                        </div>
                    )}
                    {data && (
                        <>
                            {(d.descartado || d.auto_ko) && (
                                <div className="tl-fi-aviso">
                                    <AlertTriangle size={18} aria-hidden="true" />
                                    <span>
                                        <b>El formulario cortó esta postulación · </b>
                                        {d.motivo_descarte || 'Una respuesta excluyente cortó el formulario. Está marcada con «Corta».'}
                                        {!d.estado && ' Si igual vale la pena, podés seleccionarla o pasarla a prueba.'}
                                    </span>
                                </div>
                            )}
                            {secciones.length === 0 && <div className="tl-fi-vacio">Todavía no hay respuestas para revisar.</div>}
                            {secciones.length > 0 && columnas.map((col, k) => (
                                <div key={`${applicationId}-${k}`} className="tl-fi-col">
                                    {col.map(({ s, i }) => (
                                        <Seccion key={`${s.titulo}-${i}`} s={s} i={i} puntos={puntos} abiertas={abiertas}
                                            onToggle={toggle} onCopiar={copiar} />
                                    ))}
                                </div>
                            ))}
                            <PanelDecision d={d} botones={botonesDe(d)} titulos={titulos} onDecidir={decidir}
                                nota={[nota, copiado && `${copiado} copiado`].filter(Boolean).join(' · ')} />
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default HiringCandidateModal;
