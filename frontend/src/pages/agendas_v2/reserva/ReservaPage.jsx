import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronUp, Clock, MessageCircle, Video } from 'lucide-react';
import PantallaPregunta from './PantallaPregunta';
import PantallaHorario from './PantallaHorario';
import PantallaConfirmado from './PantallaConfirmado';
import Preparacion from './Preparacion';
import PanelLab from './PanelLab';
import { ASIGNADAS_SEMANA, funnelPorId, PREGUNTAS, PREPARACION } from '../shared/mockData';
import { asignarHorario, decidir } from '../shared/engine';
import { cargarEstrategia } from '../shared/labStore';
import { browserTz } from '../shared/time';
import './reserva.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function armarPasos() {
    return [
        { id: 'intro', tipo: 'intro' },
        { id: 'nombre', tipo: 'campo', texto: '¿Cómo te llamás?', placeholder: 'Nombre y apellido', autoComplete: 'name', validar: v => (v.trim().split(/\s+/).length < 2 ? 'Escribí nombre y apellido.' : null) },
        { id: 'whatsapp', tipo: 'telefono', texto: '¿A qué WhatsApp te escribimos?', ayuda: 'Por ahí te confirmamos la llamada y te avisamos si algo cambia.', validar: v => (v.replace(/\D/g, '').length < 7 ? 'Revisá el número: parece incompleto.' : null) },
        { id: 'email', tipo: 'campo', inputType: 'email', autoComplete: 'email', texto: '¿Y tu mail?', ayuda: 'Ahí te llega la invitación con el link de Meet.', placeholder: 'nombre@mail.com', validar: v => (!EMAIL_RE.test(v.trim()) ? 'Revisá el mail: le falta algo.' : null) },
        { id: 'instagram', tipo: 'campo', opcional: true, texto: '¿Tu usuario de Instagram?', ayuda: 'Opcional. Nos ayuda a encontrar la conversación si ya nos escribiste.', placeholder: '@usuario' },
        ...PREGUNTAS.map(p => ({ ...p, tipo: p.tipo === 'texto' ? 'texto' : 'opciones', opcional: p.tipo === 'texto' })),
        { id: 'horario', tipo: 'horario' },
        { id: 'confirmado', tipo: 'confirmado' },
        { id: 'preparacion', tipo: 'preparacion' },
    ];
}

const transicion = { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -28 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } };

// Laboratorio de la reserva del lead: Typeform (una pregunta por pantalla) + Calendly (calendario)
// + preparación con videos. Sin backend: el motor corre en el navegador con datos de ejemplo.
export default function ReservaPage() {
    const params = useParams();
    const [funnelId, setFunnelId] = useState(params.funnel || 'workshop');
    const funnel = funnelPorId(funnelId);
    const estrategia = useMemo(() => cargarEstrategia(funnelId), [funnelId]);
    const pasos = useMemo(armarPasos, []);

    const [i, setI] = useState(0);
    const [r, setR] = useState({ whatsapp: { prefijo: '+54', numero: '' } });
    const [tz, setTz] = useState(browserTz);
    const [reserva, setReserva] = useState(null);
    const [prep, setPrep] = useState({});
    const [prepIdx, setPrepIdx] = useState(0);
    const paso = pasos[i];

    const ahora = useMemo(() => Date.now(), []);
    const decision = useMemo(() => decidir(estrategia, funnel.reunion, r, ASIGNADAS_SEMANA, ahora), [estrategia, funnel, r, ahora]);

    const siguiente = useCallback(() => setI(n => Math.min(n + 1, pasos.length - 1)), [pasos.length]);
    const anterior = () => setI(n => Math.max(n - 1, 0));
    const cambiar = (id) => (v) => setR(prev => ({ ...prev, [id]: v }));

    const confirmar = (utc) => {
        setReserva({ utc, ...asignarHorario(decision, utc) });
        siguiente();
    };

    const usarPerfil = (perfil) => {
        setR(prev => ({ nombre: prev.nombre || 'Lead de Prueba', whatsapp: prev.whatsapp?.numero ? prev.whatsapp : { prefijo: '+54', numero: '11 2345 6789' }, email: prev.email || 'lead@ejemplo.com', instagram: prev.instagram, ...perfil }));
        setReserva(null);
        setI(pasos.findIndex(p => p.id === 'horario'));
    };

    // Riel: de "nombre" a "horario" en el formulario; en la preparación, un segmento por video.
    const idxHorario = pasos.findIndex(p => p.id === 'horario');
    const enPrep = paso.tipo === 'preparacion';
    const totalRiel = enPrep ? PREPARACION.length + 1 : idxHorario;
    const hechos = enPrep ? prepIdx : Math.min(i, idxHorario);
    const sinNav = ['intro', 'confirmado', 'preparacion'].includes(paso.tipo) || reserva;

    return (
        <div className="bg-v6 ag2-lead">
            <header className="ag2-head">
                <div className="ag2-head-row">
                    <span className="ag2-runhead"><b>Learnation</b></span>
                    <span className="ag2-runhead">{enPrep ? 'Preparación' : funnel.reunion.titulo}</span>
                </div>
                {paso.tipo !== 'intro' && (
                    <div className="ag2-rail" aria-hidden="true">
                        {Array.from({ length: totalRiel }, (_, k) => <span key={k} className={k < hechos ? 'on' : ''} />)}
                    </div>
                )}
            </header>

            <main className="ag2-stage">
                <AnimatePresence mode="wait">
                    <motion.div key={paso.id} {...transicion} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        {paso.tipo === 'intro' && (
                            <div className="ag2-screen">
                                <h1 className="ag2-display">Agendá tu llamada de <span className="ag2-hl">diagnóstico</span></h1>
                                <p className="ag2-lede">Respondé unas preguntas cortas y elegí el horario. En la llamada vemos dónde estás, cuánto te falta y qué plan tiene sentido para vos.</p>
                                <div className="ag2-meta">
                                    <span><Clock size={15} /> {funnel.reunion.duracion} minutos</span>
                                    <span><Video size={15} /> Google Meet</span>
                                    <span><MessageCircle size={15} /> Confirmación por WhatsApp</span>
                                </div>
                                <div className="ag2-actions">
                                    <button type="button" className="ag2-btn" onClick={siguiente}>Empezar <ArrowRight size={16} /></button>
                                    <span className="ag2-hint">Tarda 2 minutos</span>
                                </div>
                            </div>
                        )}
                        {['campo', 'telefono', 'opciones', 'texto'].includes(paso.tipo) && (
                            <PantallaPregunta paso={paso} valor={r[paso.id]} onCambio={cambiar(paso.id)} onSiguiente={siguiente}
                                titulo={paso.id === 'whatsapp' && r.nombre ? `${r.nombre.trim().split(' ')[0]}, ¿a qué WhatsApp te escribimos?` : paso.texto} />
                        )}
                        {paso.tipo === 'horario' && (
                            <PantallaHorario horarios={decision.oferta.horarios} tz={tz} onTz={setTz} reunion={funnel.reunion} onConfirmar={confirmar} />
                        )}
                        {paso.tipo === 'confirmado' && reserva && (
                            <PantallaConfirmado reserva={reserva} nombre={r.nombre} whatsapp={r.whatsapp} email={r.email} tz={tz} reunion={funnel.reunion} onPreparar={siguiente} />
                        )}
                        {paso.tipo === 'preparacion' && reserva && (
                            <Preparacion pasos={PREPARACION} reserva={reserva} tz={tz} respuestas={prep} onIndice={setPrepIdx}
                                onRespuesta={(id, v) => setPrep(p => ({ ...p, [id]: v }))} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {!sinNav && (
                <nav className="ag2-nav" aria-label="Navegación">
                    <button type="button" aria-label="Anterior" disabled={i <= 1} onClick={anterior}><ChevronUp size={18} /></button>
                    <button type="button" aria-label="Siguiente" disabled={paso.tipo === 'horario' || (!r[paso.id] && !paso.opcional)} onClick={siguiente}><ChevronDown size={18} /></button>
                </nav>
            )}

            <PanelLab funnelId={funnelId} onFunnel={setFunnelId} decision={decision} reserva={reserva} onPerfil={usarPerfil} />
        </div>
    );
}
