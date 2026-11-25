import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Check } from 'lucide-react';
import { Avatar, Segmented, Select } from '../../../standard';
import { useMovimiento } from '../../piezas';
import CalendarioDias from './CalendarioDias';
import { ANTICIPACIONES, FRANJAS, ciudad, diaLargo, diasDelLead, enPuntoOMedia, franjaDe, horaEn } from './reprogramar';

const SUAVE = [0.22, 0.7, 0.2, 1];

/**
 * Paso 2: primero el día (calendario), después la hora. La hora grande es la del lead, que es la que se
 * le dice; al lado, de quién es el horario y qué hora es para esa persona. De a 30 minutos, con los :15 y
 * :45 a un toque. Arriba, la zona del lead y la anticipación mínima.
 */
const PasoHorario = ({ mapa, tzLead, onTzLead, zonas, zonaLeadTz, persona, cuando, onCuando, quien, onQuien, anticipacion, onAnticipacion }) => {
    const mov = useMovimiento();
    const dias = diasDelLead(mapa, tzLead);
    const [dia, setDia] = useState(null);
    const [cada15, setCada15] = useState(false);

    // Con un horario ya elegido se abre en su día; si el día elegido dejó de existir (otra zona u otra
    // anticipación), se vuelve a elegir.
    useEffect(() => {
        const conCuando = cuando && dias.find((d) => d.isos.includes(cuando));
        if (conCuando) setDia(conCuando.dia);
        else if (dia && !dias.some((d) => d.dia === dia)) setDia(null);
    }, [tzLead, mapa]); // eslint-disable-line react-hooks/exhaustive-deps

    const delDia = dias.find((d) => d.dia === dia)?.isos || [];
    const redondos = delDia.filter((iso) => cada15 || enPuntoOMedia(iso, tzLead) || iso === cuando);
    const isos = redondos.length ? redondos : delDia;
    const hayCuartos = delDia.some((iso) => !enPuntoOMedia(iso, tzLead));
    const nombreZona = zonas.find((z) => z.tz === tzLead)?.nombre || ciudad(tzLead);
    const opcionesZona = [
        ...(zonas.some((z) => z.tz === tzLead) ? [] : [{ value: tzLead, label: ciudad(tzLead) }]),
        ...zonas.map((z) => ({ value: z.tz, label: `${z.nombre}${z.tz === zonaLeadTz ? ' · la del lead' : ''}` })),
    ];

    const controles = (
        <div className="rp-controles">
            <label className="rp-control">
                <small className="t-rotulo">Hora del lead</small>
                <Select size="sm" label="Zona del lead" value={tzLead} onChange={onTzLead} options={opcionesZona} />
            </label>
            <div className="rp-control">
                <small className="t-rotulo">Anticipación mínima</small>
                <Segmented size="sm" radio label="Anticipación mínima" value={anticipacion} onChange={onAnticipacion} options={ANTICIPACIONES} />
            </div>
        </div>
    );

    if (dias.length === 0) {
        return (
            <div className="rp-paso">
                {controles}
                <div className="rp-vacio">
                    <CalendarDays size={22} />
                    <b>No hay horarios libres en los próximos 14 días</b>
                    <small>Bajá la anticipación, o volvé y elegí otra persona o «Cualquiera».</small>
                </div>
            </div>
        );
    }

    return (
        <div className="rp-paso">
            {controles}
            <div className="rp-agenda">
                <CalendarioDias dias={dias} tz={tzLead} valor={dia} onElegir={setDia} />

                <div className="rp-horas-col">
                    {!dia ? (
                        <div className="rp-vacio">
                            <CalendarDays size={22} />
                            <b>Elegí un día</b>
                            <small>Los días marcados tienen horarios libres; el número es cuántos.</small>
                        </div>
                    ) : (
                        <motion.div key={`${dia}-${cada15}`} className="rp-horas-lista"
                            {...(mov.quieto ? {} : { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.28, ease: SUAVE } })}>
                            <div className="rp-horas-cab">
                                <b>{diaLargo(dia)}</b>
                                <small>{`${delDia.length} ${delDia.length === 1 ? 'horario' : 'horarios'} · en hora de ${nombreZona}`}</small>
                            </div>
                            <div className="rp-horas-scroll" role="radiogroup" aria-label="Hora">
                                {FRANJAS.map((f) => {
                                    const deFranja = isos.filter((iso) => franjaDe(iso, tzLead) === f.clave);
                                    if (!deFranja.length) return null;
                                    return (
                                        <div key={f.clave} className="rp-franja">
                                            <small className="rp-franja-tit">{f.label}</small>
                                            {deFranja.map((iso, i) => {
                                                const ids = mapa[iso] || [];
                                                const sel = iso === cuando;
                                                return (
                                                    <motion.div key={iso} className="rp-slot" data-sel={sel || undefined}
                                                        {...(mov.quieto ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: SUAVE, delay: Math.min(i, 10) * 0.025 } })}>
                                                        <button type="button" role="radio" aria-checked={sel} className="rp-slot-btn" onClick={() => onCuando(iso)}>
                                                            <span className="rp-slot-hora">
                                                                <b>{horaEn(iso, tzLead)}</b>
                                                                <small>{nombreZona}</small>
                                                            </span>
                                                            <span className="rp-slot-gente">
                                                                {ids.map((id) => {
                                                                    const p = persona(id);
                                                                    const suya = horaEn(iso, p.tz);
                                                                    return (
                                                                        <span key={id} className="rp-slot-p" data-elegida={sel && quien === id || undefined}>
                                                                            <Avatar name={p.nombre} size="xs" />
                                                                            <span>{p.nombre.split(' ')[0]}</span>
                                                                            <em>{p.tz === tzLead ? 'misma hora' : `${suya} en ${ciudad(p.tz)}`}</em>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </span>
                                                            <span className="rp-slot-check" aria-hidden="true">{sel && <Check size={16} />}</span>
                                                        </button>
                                                        {sel && ids.length > 1 && (
                                                            <div className="rp-slot-con">
                                                                <small>¿Con quién?</small>
                                                                {ids.map((id) => (
                                                                    <button key={id} type="button" className="fi-pildora" aria-pressed={quien === id} onClick={() => onQuien(id)}>
                                                                        {persona(id).nombre}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                            {hayCuartos && (
                                <button type="button" className="rp-link" onClick={() => setCada15((v) => !v)}>
                                    {cada15 ? 'Ver solo en punto y media' : 'Ver también :15 y :45'}
                                </button>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PasoHorario;
