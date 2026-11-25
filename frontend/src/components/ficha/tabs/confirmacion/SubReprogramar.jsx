import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, CalendarDays, Check, Hourglass, PenLine, Users } from 'lucide-react';
import { Avatar, FieldError, Segmented, Select, TextArea } from '../../../standard';
import api from '../../../../services/api';
import { faltaDeMotivo, motivoAlcanza, preguntaDeMotivo } from '../../../../utils/motivoEstado';
import { SubVista, useMovimiento } from '../../piezas';
import PasoPersona from './PasoPersona';
import PasoHorario from './PasoHorario';
import Bandera from './Bandera';
import {
    ANTICIPACIONES, CUALQUIERA, ciudad, coloresDe, conAnticipacion, diaLargo, guardarAnticipacion, horaEn, leerAnticipacion,
    libresPorHorario, quienToma,
} from './reprogramar';
import './reprogramar.css';

const PASOS = [
    { label: 'Con quién', Icono: Users },
    { label: 'Día y hora', Icono: CalendarDays },
    { label: 'Motivo', Icono: PenLine },
];
const SUAVE = [0.22, 0.7, 0.2, 1];

/**
 * Reprogramar la llamada, en tres pasos (con quién → día y hora → motivo). Mientras está abierto, la
 * ficha muestra solo la cabecera y esta tarea (`onEnfoque` de la pestaña).
 *
 * Solo se ofrecen horarios libres (horario de Team, agendas y Google), así que no hay choques. Se elige
 * el grupo (closers o triage: por defecto el de quien tiene la llamada) y una persona o «Cualquiera»:
 * con «Cualquiera» se ven los horarios de todo el grupo y la llamada queda con la persona actual si está
 * libre, o con la que tiene más horarios libres. Las horas se leen en la del lead, y al lado la de quien
 * la va a tomar.
 */
const SubReprogramar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const apptId = ficha?.identidad?.appointment_id;
    const mov = useMovimiento();
    const [paso, setPaso] = useState(0);
    const dir = useRef(1);
    const [pedido, setPedido] = useState(null);
    const [datos, setDatos] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [cuando, setCuando] = useState(null);
    const [quien, setQuien] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [tzLead, setTzLead] = useState(null);
    const [anticipacion, setAnticipacion] = useState(leerAnticipacion);

    useEffect(() => {
        let vivo = true;
        setCuando(null);
        setQuien(null);
        api.get(`/ficha/${apptId}/reprogramar/opciones`, { params: pedido ? { rol: pedido } : {} })
            .then((res) => {
                if (!vivo) return;
                const d = res.data || {};
                setDatos(d);
                setTzLead((t) => t || d.zona_lead?.tz || null);
                const libreActual = (d.horarios_por_persona?.[String(d.actual_id)] || []).length > 0;
                setElegida(libreActual ? d.actual_id : CUALQUIERA);
            })
            .catch(() => vivo && setDatos({ error: true }));
        return () => { vivo = false; };
    }, [apptId, pedido]);

    const rol = pedido || datos?.rol;
    const cargandoGrupo = !!pedido && datos?.rol !== pedido;
    // Solo los horarios con la anticipación elegida (1 h, 2 h…): cuentan también en el paso 1.
    const porPersona = useMemo(() => conAnticipacion(datos?.horarios_por_persona, anticipacion), [datos, anticipacion]);
    const personas = datos?.personas || [];
    const persona = (id) => personas.find((p) => p.id === id) || { nombre: '—', tz: tzLead };
    const mapa = useMemo(() => libresPorHorario(porPersona, elegida), [porPersona, elegida]);
    const totalGrupo = useMemo(() => Object.keys(libresPorHorario(porPersona, CUALQUIERA)).length, [porPersona]);
    const lead = tzLead || 'UTC';
    const nombreZona = (datos?.zonas || []).find((z) => z.tz === lead)?.nombre || ciudad(lead);
    const colores = useMemo(() => coloresDe(personas), [datos]); // eslint-disable-line react-hooks/exhaustive-deps
    const colorDe = (id) => colores[id] || 'var(--idle)';
    const paisDe = (tz) => (datos?.zonas || []).find((z) => z.tz === tz)?.pais;

    const elegirHora = (iso) => {
        setCuando(iso);
        setQuien(elegida === CUALQUIERA ? quienToma(mapa[iso], datos.actual_id, porPersona) : elegida);
    };
    const elegirPersona = (p) => { setElegida(p); setCuando(null); setQuien(null); };
    const cambiarAnticipacion = (m) => {
        setAnticipacion(m);
        guardarAnticipacion(m);
        if (cuando && new Date(cuando).getTime() < Date.now() + m * 60000) { setCuando(null); setQuien(null); }
    };

    const listo = [elegida != null && totalGrupo > 0 && !cargandoGrupo, !!cuando && !!quien, motivoAlcanza(motivo)];
    const ir = (i) => { dir.current = i >= paso ? 1 : -1; setPaso(i); };
    const atras = () => (paso === 0 ? onVolver() : ir(paso - 1));

    const accion = paso < 2 ? (
        <button type="button" className="btn btn--cta" disabled={!listo[paso]} onClick={() => ir(paso + 1)}>
            Siguiente <ArrowRight size={14} />
        </button>
    ) : (
        <button type="button" className="btn btn--cta" disabled={!listo.every(Boolean) || guardando}
            onClick={() => onConfirmar({ inicio: cuando, persona_id: quien, motivo: motivo.trim() })}>
            {guardando ? 'Reprogramando…' : 'Reprogramar'}
        </button>
    );

    // Los pasos: ícono en un círculo, unidos por una línea que se llena al avanzar.
    const pasos = (
        <ol className="rp-pasos" aria-label="Pasos">
            {PASOS.map(({ label, Icono }, i) => (
                <li key={label} data-estado={i < paso ? 'hecho' : i === paso ? 'actual' : 'pendiente'}>
                    <button type="button" disabled={i > paso && !listo.slice(0, i).every(Boolean)} onClick={() => ir(i)}
                        aria-current={i === paso ? 'step' : undefined} aria-label={label}>
                        <span className="rp-pasos-n">{i < paso ? <Check size={15} strokeWidth={3} /> : <Icono size={15} />}</span>
                        <span className="rp-pasos-txt">{label}</span>
                    </button>
                </li>
            ))}
        </ol>
    );
    // Zona del lead y anticipación, en la misma fila que el título y los pasos (solo en «Día y hora»).
    const zonas = datos?.zonas || [];
    const controles = paso === 1 && datos && !datos.error && (
        <div className="rp-controles">
            <div className="rp-control" data-tip="Hora del lead">
                <Select size="sm" label="Hora del lead" value={lead} onChange={setTzLead}
                    options={[
                        ...(zonas.some((z) => z.tz === lead) ? [] : [{ value: lead, label: ciudad(lead) }]),
                        ...zonas.map((z) => ({ value: z.tz, icon: <Bandera c={z.pais} />, label: z.nombre })),
                    ]} />
            </div>
            <Segmented size="sm" radio label="Anticipación mínima" value={anticipacion} onChange={cambiarAnticipacion}
                options={ANTICIPACIONES} data-tip="Anticipación mínima"
                prefix={<span className="rp-seg-ico" aria-hidden="true"><Hourglass size={14} /></span>} />
        </div>
    );
    const cabecera = (
        <div className="rp-cab">
            {pasos}
            {controles}
        </div>
    );
    const titulo = (
        <span className="rp-titulo">
            <span className="rp-titulo-ico" aria-hidden="true"><CalendarClock size={18} /></span>
            Reprogramar
        </span>
    );

    const entrada = mov.quieto ? {} : {
        initial: { opacity: 0, x: 28 * dir.current, filter: 'blur(4px)' },
        animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
        transition: { duration: 0.34, ease: SUAVE },
    };

    const q = cuando && quien ? persona(quien) : null;

    return (
        <SubVista titulo={titulo} extra={cabecera} onVolver={atras}
            acciones={datos && !datos.error ? accion : null}>
            {datos === null && (
                <div className="rp-cargando" role="status">
                    <span className="rp-pulso" aria-hidden="true" />
                    Buscando horarios libres…
                </div>
            )}
            {datos?.error && <small className="t-cap mut">No se pudieron cargar los horarios. Cerrá y volvé a abrir la ficha.</small>}

            {datos && !datos.error && (
                <motion.div key={paso} {...entrada}>
                    {paso === 0 && (
                        <div style={{ opacity: cargandoGrupo ? 0.5 : 1, transition: 'opacity .2s' }}>
                            <PasoPersona rol={rol} onRol={(r) => { if (r !== rol) setPedido(r); }} personas={personas}
                                porPersona={porPersona} actualId={datos.actual_id} elegida={elegida}
                                onElegir={elegirPersona} totalGrupo={totalGrupo} paisDe={paisDe} colorDe={colorDe} />
                        </div>
                    )}

                    {paso === 1 && (
                        <PasoHorario mapa={mapa} tzLead={lead} persona={persona} colorDe={colorDe}
                            cuando={cuando} onCuando={elegirHora} quien={quien} onQuien={setQuien} paisDe={paisDe} />
                    )}

                    {paso === 2 && q && (
                        <div className="rp-paso">
                            <div className="rp-resumen">
                                <div className="rp-resumen-dia">
                                    <small>{diaLargo(new Date(cuando).toLocaleDateString('en-CA', { timeZone: lead })).split(' ')[0]}</small>
                                    <b>{new Date(cuando).toLocaleDateString('es', { day: 'numeric', timeZone: lead })}</b>
                                    <small>{new Date(cuando).toLocaleDateString('es', { month: 'short', timeZone: lead }).replace('.', '')}</small>
                                </div>
                                <div className="rp-resumen-hora">
                                    <b>{horaEn(cuando, lead)}</b>
                                    <small className="rp-con-bandera"><Bandera c={paisDe(lead)} />{`Lead · ${nombreZona}`}</small>
                                </div>
                                <div className="rp-resumen-quien">
                                    <Avatar name={q.nombre} size="lg" color={colorDe(quien)} />
                                    <div>
                                        <b>{q.nombre}</b>
                                        <small className="rp-con-bandera">
                                            <Bandera c={paisDe(q.tz)} />
                                            {q.tz === lead ? 'misma hora' : `${horaEn(cuando, q.tz)} su hora`}
                                            {quien !== datos.actual_id && ` · era de ${persona(datos.actual_id).nombre.split(' ')[0]}`}
                                        </small>
                                    </div>
                                </div>
                            </div>
                            <div className="rp-motivo">
                                <small className="t-rotulo">{preguntaDeMotivo('Reagendado')}</small>
                                <TextArea aria-label="Motivo" rows={3} value={motivo} autoFocus
                                    invalid={!!motivo && !motivoAlcanza(motivo)} placeholder="Ej.: pidió cambiar el horario porque trabaja de guardia"
                                    onChange={(e) => setMotivo(e.target.value)} />
                                {motivo && faltaDeMotivo(motivo) && <FieldError role="note" icon={false}>{faltaDeMotivo(motivo)}</FieldError>}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </SubVista>
    );
};

export default SubReprogramar;
