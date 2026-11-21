import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Target, Mail, PlayCircle, PhoneCall,
} from 'lucide-react';
import api from '../../../../../services/api';
import { useAuth } from '../../../../../contexts/AuthContext';
import { Aura } from '../../../../../components/standard';
import { href, soloDigitos } from '../../lib/escalas';
import { accionesCloser, edadCorta, puntajeCloser, seccionesCloser } from '../../lib/closers';
import { Seccion, repartir } from '../SeccionesFicha';
import PanelDecision from '../PanelDecision';
import { AJUSTE_MIN, Capsula, useDimensionesPanel } from '../HiringCandidateModal';
import { Bandera, LOGO_APP } from '../Piezas';
import '../fichaPostulacion.css';

// La ficha de una postulación de Closer con el diseño de la de Asistente (ADR-W192): las
// respuestas en tarjetas por sección, el score de Clarity con su desglose y las decisiones a la
// derecha. Decidir es votar (Preseleccionar, Reserva, Descartar; tocar otra vez lo deshace) y,
// con la preselección hecha, «Pasar a prueba» (la resolución `testeo`).

const ACCION = {
    pre: { id: 'pre', label: 'Preseleccionar', icon: CheckCircle2 },
    testeo: { id: 'testeo', label: 'Pasar a prueba', icon: Target },
    res: { id: 'res', label: 'Reserva', icon: Clock },
    des: { id: 'des', label: 'Descartar', icon: XCircle },
};
const VOTO_TXT = { pre: 'preseleccionó', res: 'dejó en reserva', des: 'descartó' };

const FichaCloser = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [fallo, setFallo] = useState(false);
    const [abiertas, setAbiertas] = useState(new Set());
    const [copiado, setCopiado] = useState(null);
    const cuerpo = useRef(null);
    const dim = useDimensionesPanel();
    const [ajuste, setAjuste] = useState(1);

    useLayoutEffect(() => { setAjuste(1); }, [applicationId, data, abiertas, dim]);
    useLayoutEffect(() => {
        const el = cuerpo.current;
        if (!el || !data || !dim || ajuste <= AJUSTE_MIN) return;
        if (el.scrollHeight > el.clientHeight + 1) {
            const paso = Math.max(el.clientHeight / el.scrollHeight, 0.96);
            setAjuste((a) => Math.max(AJUSTE_MIN, Math.floor(a * paso * 1000) / 1000));
        }
    });
    const zoom = dim ? dim.zoom * ajuste : 1;
    const medidas = dim && {
        zoom,
        width: Math.floor((dim.width * dim.zoom) / zoom),
        height: Math.floor((dim.height * dim.zoom) / zoom),
    };

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
        setAbiertas(new Set());
        if (applicationId) cargar(applicationId);
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
    const toggle = (campo) => setAbiertas((prev) => (prev.has(campo) ? new Set() : new Set([campo])));

    const secciones = data ? seccionesCloser(d) : [];
    const puntaje = puntajeCloser(d.criterios);
    const puntos = Object.fromEntries(puntaje.map((r) => [r.id, r]));
    const columnas = repartir(secciones);
    const digitos = soloDigitos(d.whatsapp);
    const videoHref = href(d.video);
    const llamadaHref = href(d.llamada);
    const votos = (d.votos_detalle || []).map((v) => `${v.reviewer_name} ${VOTO_TXT[v.vote] || v.vote}`);
    const panel = {
        ...d,
        veredicto: d.veredicto,
        edad: edadCorta(d.edad),
        estado: enPrueba ? 'testeo' : miVoto,
        puntaje,
        perfil_extra: [
            d.ingles && ['Inglés', d.ingles],
            d.fuente && ['Llegó por', d.bolsa ? `${d.fuente} · ${d.bolsa}` : d.fuente],
        ].filter(Boolean),
    };

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/80 p-0 backdrop-blur-sm [@media(min-width:640px)_and_(min-height:681px)]:p-[2vh]"
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

                <div ref={cuerpo} className={`tl-fi-cuerpo custom-scrollbar${columnas.cuali ? ' is-cuali' : ''}`}>
                    {!data && (
                        <div className="tl-fi-vacio" style={fallo ? { color: 'var(--error)' } : undefined}>
                            {fallo ? 'No se pudo cargar la postulación.' : 'Cargando la postulación…'}
                        </div>
                    )}
                    {data && columnas.map((col, k) => (
                        <div key={`${applicationId}-${k}`} className="tl-fi-col">
                            {col.map(({ s, i }) => (
                                <Seccion key={`${s.titulo}-${i}`} s={s} i={i} puntos={puntos} abiertas={abiertas} onToggle={toggle} onCopiar={copiar} />
                            ))}
                        </div>
                    ))}
                    {data && (
                        <PanelDecision d={panel} botones={accionesCloser(d.veredicto).map((id) => ACCION[id])}
                            titulos={secciones.map((s) => s.titulo)} onDecidir={decidir}
                            nota={[...votos, copiado && `${copiado} copiado`].filter(Boolean).join(' · ')} />
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FichaCloser;
