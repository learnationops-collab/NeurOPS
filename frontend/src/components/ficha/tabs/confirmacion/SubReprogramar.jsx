import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Avatar, FieldError, TextArea } from '../../../standard';
import api from '../../../../services/api';
import { browserTimezone } from '../../../../utils/datetime';
import { faltaDeMotivo, motivoAlcanza, preguntaDeMotivo } from '../../../../utils/motivoEstado';
import { SubVista } from '../../piezas';
import PasoPersona from './PasoPersona';
import PasoHorario from './PasoHorario';
import { CUALQUIERA, conAnticipacion, horaEn, leerAnticipacion, guardarAnticipacion, libresPorHorario, quienToma, rotuloDia } from './reprogramar';
import './reprogramar.css';

const PASOS = ['Con quién', 'Día y hora', 'Motivo'];

/**
 * Reprogramar la llamada, en tres pasos (con quién → día y hora → motivo).
 *
 * Solo se ofrecen horarios libres (horario de Team, agendas y Google), así que no hay choques. Se elige
 * el grupo (closers o triage: por defecto el de quien tiene la llamada) y una persona o «cualquiera»:
 * con «cualquiera» se ven los horarios de todo el grupo y la llamada queda con la persona actual si está
 * libre, o con la que tiene más horarios libres. Las horas se leen en la del lead, con la tuya debajo.
 */
const SubReprogramar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const apptId = ficha?.identidad?.appointment_id;
    const [paso, setPaso] = useState(0);
    const [pedido, setPedido] = useState(null);
    const [datos, setDatos] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [cuando, setCuando] = useState(null);
    const [quien, setQuien] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [tzLead, setTzLead] = useState(null);
    const [anticipacion, setAnticipacion] = useState(leerAnticipacion);
    const miZona = browserTimezone();

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        setCuando(null);
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

    const rol = datos?.rol || pedido;
    // Solo los horarios con la anticipación elegida (1 h, 2 h…): cuentan también en el paso 1.
    const porPersona = useMemo(() => conAnticipacion(datos?.horarios_por_persona, anticipacion), [datos, anticipacion]);
    const personas = datos?.personas || [];
    const nombre = (id) => personas.find((p) => p.id === id)?.nombre || '—';
    const mapa = useMemo(() => libresPorHorario(porPersona, elegida), [porPersona, elegida]); // eslint-disable-line react-hooks/exhaustive-deps
    const totalGrupo = useMemo(() => Object.keys(libresPorHorario(porPersona, CUALQUIERA)).length, [porPersona]); // eslint-disable-line react-hooks/exhaustive-deps
    const lead = tzLead || miZona;
    const libres = cuando ? mapa[cuando] || [] : [];

    const elegirHora = (iso) => {
        setCuando(iso);
        setQuien(elegida === CUALQUIERA ? quienToma(mapa[iso], datos.actual_id, porPersona) : elegida);
    };
    const elegirPersona = (p) => { setElegida(p); setCuando(null); setQuien(null); };

    const listo = [elegida != null && totalGrupo > 0, !!cuando && !!quien, motivoAlcanza(motivo)];
    const atras = () => (paso === 0 ? onVolver() : setPaso(paso - 1));
    const accion = paso < 2 ? (
        <button type="button" className="btn btn--cta" disabled={!listo[paso]} onClick={() => setPaso(paso + 1)}>
            Siguiente <ArrowRight size={14} />
        </button>
    ) : (
        <button type="button" className="btn btn--cta" disabled={!listo.every(Boolean) || guardando}
            onClick={() => onConfirmar({ inicio: cuando, persona_id: quien, motivo: motivo.trim() })}>
            {guardando ? 'Reprogramando…' : 'Reprogramar'}
        </button>
    );

    return (
        <SubVista titulo="Reprogramar llamada" onVolver={atras} acciones={datos && !datos.error ? accion : null}>
            <ol className="rp-pasos" aria-label="Pasos">
                {PASOS.map((p, i) => (
                    <li key={p} data-estado={i < paso ? 'hecho' : i === paso ? 'actual' : 'pendiente'}>
                        <button type="button" disabled={i > paso && !listo.slice(0, i).every(Boolean)} onClick={() => setPaso(i)}>
                            <span>{i + 1}</span>{p}
                        </button>
                    </li>
                ))}
            </ol>

            {datos === null && <small className="t-cap mut">Buscando horarios libres de todos…</small>}
            {datos?.error && <small className="t-cap mut">No se pudieron cargar los horarios. Cerrá y volvé a abrir la ficha.</small>}

            {datos && !datos.error && paso === 0 && (
                <PasoPersona rol={rol} onRol={(r) => { if (r !== rol) setPedido(r); }} personas={personas}
                    porPersona={porPersona} actualId={datos.actual_id} elegida={elegida}
                    onElegir={elegirPersona} totalGrupo={totalGrupo} />
            )}

            {datos && !datos.error && paso === 1 && (
                <>
                    <PasoHorario mapa={mapa} tzLead={lead} onTzLead={setTzLead} zonas={datos.zonas || []}
                        zonaLeadTz={datos.zona_lead?.tz} miZona={miZona} cuando={cuando} onCuando={elegirHora}
                        nombres={elegida === CUALQUIERA ? nombre : null}
                        anticipacion={anticipacion} onAnticipacion={(m) => {
                            setAnticipacion(m); guardarAnticipacion(m);
                            if (cuando && new Date(cuando).getTime() < Date.now() + m * 60000) { setCuando(null); setQuien(null); }
                        }} />
                    {cuando && elegida === CUALQUIERA && libres.length > 1 && (
                        <div className="rp-fila">
                            <small className="t-rotulo">Libres a esa hora</small>
                            {libres.map((id) => (
                                <button key={id} type="button" className="fi-pildora" aria-pressed={quien === id} onClick={() => setQuien(id)}>
                                    {nombre(id)}{id === datos.actual_id ? ' · la actual' : ''}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {datos && !datos.error && paso === 2 && cuando && (
                <div className="rp-paso">
                    <div className="rp-resumen">
                        <Avatar name={nombre(quien)} size="md" />
                        <div>
                            <b>{`${rotuloDia(new Date(cuando).toLocaleDateString('en-CA', { timeZone: lead }), lead)} · ${horaEn(cuando, lead)} para el lead`}</b>
                            <small>
                                {`${miZona !== lead ? `${horaEn(cuando, miZona)} tuya · ` : ''}con ${nombre(quien)}`}
                                {quien !== datos.actual_id && ` · se le pasa la llamada (era de ${nombre(datos.actual_id)})`}
                            </small>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                        <small className="t-rotulo">{preguntaDeMotivo('Reagendado')}</small>
                        <TextArea aria-label="Motivo" rows={3} value={motivo} autoFocus
                            invalid={!!motivo && !motivoAlcanza(motivo)} placeholder="Ej.: pidió cambiar el horario porque trabaja de guardia"
                            onChange={(e) => setMotivo(e.target.value)} />
                        {motivo && faltaDeMotivo(motivo) && <FieldError role="note" icon={false}>{faltaDeMotivo(motivo)}</FieldError>}
                    </div>
                </div>
            )}
        </SubVista>
    );
};

export default SubReprogramar;
