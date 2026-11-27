import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock, Target, Mail, PlayCircle, PhoneCall, Copy, Check,
} from 'lucide-react';
import api from '../../../../../services/api';
import { useAuth } from '../../../../../contexts/AuthContext';
import { Aura } from '../../../../../components/standard';
import { href, soloDigitos } from '../../lib/escalas';
import { CONOCIMIENTO_CORTO, accionesCloser, cierreNum, edadCorta, puntajeCloser } from '../../lib/closers';
import { Capsula, useDimensionesPanel } from '../HiringCandidateModal';
import { VEREDICTO } from '../comun';
import { Bandera, LOGO_APP } from '../Piezas';
import '../fichaPostulacion.css';
import './fichaCloser.css';

// La ficha de una postulación de Closer (rehecha el 27/11/2026). Casi todo lo que responde un closer
// es texto, así que la ficha se lee como un documento: a la izquierda, las respuestas abiertas, cada
// una para desplegar y replegar; a la derecha, lo que se mide (score y su desglose, conocimiento,
// cierre, inglés, reporte, herramientas, perfil) y, fijas abajo, las decisiones. El video y la
// llamada van solo en la cabecera. Decidir es votar (Preseleccionar, Reserva, Descartar; tocar otra
// vez lo deshace) y, con la preselección hecha, «Pasar a prueba» (la resolución `testeo`).

const ACCION = {
    pre: { id: 'pre', label: 'Preseleccionar', icon: CheckCircle2, c: 'var(--success)' },
    testeo: { id: 'testeo', label: 'Pasar a prueba', icon: Target, c: 'var(--warning)' },
    res: { id: 'res', label: 'Reserva', icon: Clock, c: 'var(--info)' },
    des: { id: 'des', label: 'Descartar', icon: XCircle, c: 'var(--error)' },
};
const VOTO_TXT = { pre: 'preseleccionó', res: 'dejó en reserva', des: 'descartó' };

// Las preguntas abiertas, en el orden en que conviene leerlas.
const ABIERTAS = [
    ['formacion', 'Formación como closer'],
    ['habilidades', 'Experiencia en venta'],
    ['dedicacion', 'A qué se dedica hoy'],
    ['obstaculo', 'Si el cierre baja, qué hace'],
    ['objetivos', 'Objetivos a largo plazo'],
    ['porque_mejor_opcion', 'Por qué es la mejor opción'],
    ['aportes', 'Qué más aporta al equipo'],
    ['porque', 'Por qué Learnation'],
];

const vacio = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const enLista = (v) => (Array.isArray(v) ? v : null);

const Respuesta = ({ id, titulo, valor, pts, abierta, onToggle, onCopiar }) => {
    const lista = enLista(valor);
    const texto = lista ? lista.join(' · ') : String(valor);
    return (
        <section className={`tl-fc-resp${abierta ? ' is-abierta' : ''}`}>
            <button type="button" className="tl-fc-resp-cab" aria-expanded={abierta} onClick={() => onToggle(id)}>
                <span className="tl-fc-resp-t">{titulo}</span>
                {pts && <span className="tl-fc-pts" title="Puntos de Clarity">{+pts.puntos.toFixed(1)}<small>/{pts.maximo}</small></span>}
                <ChevronDown size={18} className="tl-fc-resp-flecha" aria-hidden="true" />
            </button>
            {!abierta && <p className="tl-fc-resp-prev" onClick={() => onToggle(id)}>{texto}</p>}
            <div className="tl-fc-resp-cuerpo" aria-hidden={!abierta}>
                <div>
                    {lista ? (
                        <ul className="tl-fc-lista">{lista.map((x) => <li key={x}>{x}</li>)}</ul>
                    ) : <p className="tl-fc-resp-txt">{texto}</p>}
                    <button type="button" className="tl-fc-copiar" onClick={() => onCopiar(texto, titulo)} tabIndex={abierta ? 0 : -1}>
                        <Copy size={13} aria-hidden="true" /> Copiar
                    </button>
                </div>
            </div>
        </section>
    );
};

const FichaCloser = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [fallo, setFallo] = useState(false);
    const [abiertas, setAbiertas] = useState(new Set(['formacion']));
    const [copiado, setCopiado] = useState(null);
    const lectura = useRef(null);
    const dim = useDimensionesPanel();
    const medidas = dim && { zoom: dim.zoom, width: dim.width, height: dim.height };

    // Con dos pedidos en vuelo (flechas rápidas), el que llega tarde no pisa al vigente.
    const idVigente = useRef(applicationId);
    useEffect(() => { idVigente.current = applicationId; }, [applicationId]);

    const cargar = useCallback(async (id) => {
        setFallo(false);
        try {
            const res = await api.get(`/job-applications/${id}`);
            if (id === idVigente.current) setData(res.data);
        } catch (err) {
            console.error('Error al cargar la postulación de Closer:', err);
            if (id === idVigente.current) setFallo(true);
        }
    }, []);

    useEffect(() => {
        setData(null);
        setAbiertas(new Set(['formacion']));
        if (applicationId) cargar(applicationId);
        lectura.current?.scrollTo({ top: 0 });
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
    });

    const d = data || {};
    const miVoto = d.votos?.[String(user?.id)] || null;
    const enPrueba = d.resolucion === 'testeo';

    const decidir = async (accion) => {
        const esUndo = accion === 'testeo' ? enPrueba : miVoto === accion;
        try {
            if (accion === 'testeo') {
                await api.post(`/job-applications/${applicationId}/resolver`, { valor: enPrueba ? null : 'testeo' });
            } else {
                await api.post(`/job-applications/${applicationId}/vote`, { valor: accion });
            }
            onDecidido?.();
            // Decidida, salta a la siguiente para despachar en cadena (deshacer se queda).
            if (!esUndo && idx < ids.length - 1) siguiente();
            else await cargar(applicationId);
        } catch (err) {
            console.error('Error al guardar la decisión del closer:', err);
        }
    };

    const copiar = (texto, etiqueta) => {
        navigator.clipboard?.writeText(String(texto || '')).finally(() => {
            setCopiado(etiqueta);
            setTimeout(() => setCopiado(null), 1800);
        });
    };
    const toggle = (campo) => setAbiertas((prev) => {
        const nuevas = new Set(prev);
        if (nuevas.has(campo)) nuevas.delete(campo); else nuevas.add(campo);
        return nuevas;
    });

    const puntaje = puntajeCloser(d.criterios);
    const puntos = Object.fromEntries(puntaje.map((r) => [r.id, r]));
    const abiertasDe = ABIERTAS.filter(([id]) => !vacio(d[id]));
    const todasAbiertas = abiertasDe.length > 0 && abiertasDe.every(([id]) => abiertas.has(id));
    const digitos = soloDigitos(d.whatsapp);
    const videoHref = href(d.video);
    const llamadaHref = href(d.llamada);
    const votos = (d.votos_detalle || []).map((v) => `${v.reviewer_name} ${VOTO_TXT[v.vote] || v.vote}`);
    const veredicto = VEREDICTO[d.veredicto] || VEREDICTO.sin_calificar;
    const estado = enPrueba ? 'testeo' : miVoto;
    const cierre = cierreNum(d.cierre);
    const herramientas = enLista(d.herramientas) ? d.herramientas.join(', ') : d.herramientas;
    const datos = [
        ['Conocimiento', CONOCIMIENTO_CORTO[d.conocimiento] || d.conocimiento],
        ['Cierre', cierre != null ? `${cierre} %` : (d.cierre === 'nada' ? 'No lo mide' : null)],
        ['Inglés', d.ingles],
        ['Reporta sus números', d.reporte, true],
        ['Herramientas', herramientas, true],
        ['Edad', d.edad && `${edadCorta(d.edad)} años`],
        ['País', d.pais],
        ['Llegó por', d.fuente && (d.bolsa ? `${d.fuente} · ${d.bolsa}` : d.fuente), true],
    ].filter(([, v]) => !vacio(v));
    const botones = accionesCloser(d.veredicto).map((id) => ACCION[id]);

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-[#020617]/80 p-0 backdrop-blur-sm [@media(min-width:640px)_and_(min-height:681px)]:p-[2vh]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={d.nombre ? `Postulación de ${d.nombre}` : 'Postulación'}
                className={`tl-fi ${dim ? '' : 'h-full w-full'} shadow-2xl [@media(min-width:640px)_and_(min-height:681px)]:rounded-[24px] [@media(min-width:640px)_and_(min-height:681px)]:border [@media(min-width:640px)_and_(min-height:681px)]:border-white/[.15]`}
                style={medidas || undefined}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
                <header className="tl-fi-cab">
                    <Aura size="hero" colors={['var(--info)', 'var(--brand-primary)', 'var(--brand-secondary)']} />
                    <div className="tl-fi-quien">
                        <h2 className="tl-fi-nombre" title={d.nombre || undefined}>{d.nombre || (fallo ? '—' : 'Cargando…')}</h2>
                        {d.pais && <span className="tl-fi-pais"><Bandera de={d.pais} grande titulo={d.pais} />{d.pais}</span>}
                    </div>
                    <div className="tl-fi-acc">
                        {d.email && <Capsula valor={d.email} etiqueta="correo" icono={<Mail size={16} className="tl-fi-capsula-ico" aria-hidden="true" />} copiado={copiado === 'correo'} onCopiar={copiar} />}
                        {d.whatsapp && (
                            <Capsula valor={d.whatsapp} etiqueta="WhatsApp" copiado={copiado === 'WhatsApp'} onCopiar={copiar}
                                icono={<img src={LOGO_APP.whatsapp} alt="" className="tl-fi-capsula-logo" draggable={false} />}>
                                {digitos ? <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp">{d.whatsapp}</a> : d.whatsapp}
                            </Capsula>
                        )}
                        {videoHref && (
                            <a className="tl-fi-cv" href={videoHref} target="_blank" rel="noreferrer">
                                <Aura colors={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary)']} />
                                <PlayCircle size={16} aria-hidden="true" /> Video
                            </a>
                        )}
                        {llamadaHref && (
                            <a className="tl-fi-cv" href={llamadaHref} target="_blank" rel="noreferrer">
                                <Aura colors={['var(--info)', 'var(--brand-primary)', 'var(--info)']} />
                                <PhoneCall size={16} aria-hidden="true" /> Llamada
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

                <div className="tl-fc-cuerpo">
                    <div ref={lectura} className="tl-fc-lectura custom-scrollbar">
                        {!data && (
                            <div className="tl-fi-vacio" style={fallo ? { color: 'var(--error)' } : undefined}>
                                {fallo ? 'No se pudo cargar la postulación.' : 'Cargando la postulación…'}
                            </div>
                        )}
                        {data && (
                            <>
                                <div className="tl-fc-lect-cab">
                                    <span className="tl-fi-etq">Respuestas · {abiertasDe.length}</span>
                                    <button type="button" className="tl-fc-todas"
                                        onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(abiertasDe.map(([id]) => id)))}>
                                        {todasAbiertas ? 'Replegar todas' : 'Desplegar todas'}
                                    </button>
                                </div>
                                {abiertasDe.map(([id, titulo]) => (
                                    <Respuesta key={`${applicationId}-${id}`} id={id} titulo={titulo} valor={d[id]} pts={puntos[id]}
                                        abierta={abiertas.has(id)} onToggle={toggle} onCopiar={copiar} />
                                ))}
                            </>
                        )}
                    </div>

                    {data && (
                        <aside className="tl-fc-lado" aria-label="Lo que se mide y la decisión">
                            <div className="tl-fc-lado-scroll custom-scrollbar">
                                <div className="tl-fi-score">
                                    <Aura size="card" colors={['var(--success)', 'var(--info)', 'var(--brand-secondary)']} />
                                    <div className="tl-fi-score-cab">
                                        <strong className="tl-fi-score-num">{d.score ?? '—'}</strong>
                                        <span className="tl-fi-score-etq">Score<small>de 100</small></span>
                                        <span className="tl-fi-estado" style={{ color: veredicto.fg, background: veredicto.bg, borderColor: veredicto.bd }}>{veredicto.label}</span>
                                    </div>
                                    {puntaje.map((r, k) => {
                                        const ratio = r.maximo ? r.puntos / r.maximo : 0;
                                        return (
                                            <div key={r.id} className="tl-fc-crit" style={{ '--i': k, '--c': ratio >= 0.8 ? 'var(--success)' : ratio >= 0.5 ? 'var(--info)' : 'var(--error)' }}>
                                                <span>{r.bloque}</span>
                                                <b>{+r.puntos.toFixed(1)}<small> / {r.maximo}</small></b>
                                                <span className="tl-fi-barra"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="tl-fc-datos">
                                    {datos.map(([k, v, largo]) => (
                                        <div key={k} className={`tl-fc-dato${largo ? ' is-largo' : ''}`}><span>{k}</span><b>{v}</b></div>
                                    ))}
                                </div>
                            </div>

                            <div className="tl-fc-decide">
                                {(votos.length > 0 || copiado) && (
                                    <span className="tl-fi-nota">{[...votos, copiado && `${copiado} copiado`].filter(Boolean).join(' · ')}</span>
                                )}
                                <div className={`tl-fc-botones${botones.length > 3 ? ' is-cuatro' : ''}`}>
                                    {botones.map((a) => {
                                        const activo = estado === a.id;
                                        return (
                                            <button key={a.id} type="button" className={`tl-fc-btn${activo ? ' is-activo' : ''}`} style={{ '--c': a.c }}
                                                aria-pressed={activo} title={activo ? 'Tocar otra vez lo deshace' : a.label} onClick={() => decidir(a.id)}>
                                                {activo ? <Check size={20} aria-hidden="true" /> : <a.icon size={20} aria-hidden="true" />}
                                                <span>{a.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FichaCloser;
