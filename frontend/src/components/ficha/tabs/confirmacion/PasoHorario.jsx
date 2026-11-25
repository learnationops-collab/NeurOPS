import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Layers, Moon, Sun, Sunrise } from 'lucide-react';
import { Avatar } from '../../../standard';
import { useMovimiento } from '../../piezas';
import CalendarioDias from './CalendarioDias';
import Bandera from './Bandera';
import { FRANJAS, ciudad, diaLargo, diasDelLead, franjaDe, horaEn } from './reprogramar';

const SUAVE = [0.22, 0.7, 0.2, 1];
const ICONO_FRANJA = { manana: Sunrise, tarde: Sun, noche: Moon };

/**
 * Paso 2: primero el día (calendario), después la hora. Todos los horarios del día a la vista, en la
 * hora del lead, en una grilla compacta. Cada persona tiene su color: los puntos de cada hora dicen de
 * quién es, y una hora con dos o más libres (superpuesta) lo marca. Al elegir una, abajo se ve con quién
 * queda y qué hora es para esa persona; si hay varias libres, se elige ahí. La zona del lead y la
 * anticipación van en la cabecera (SubReprogramar).
 */
const PasoHorario = ({ mapa, tzLead, persona, colorDe, cuando, onCuando, quien, onQuien, paisDe, onSiguiente }) => {
    const mov = useMovimiento();
    const dias = diasDelLead(mapa, tzLead);
    const [dia, setDia] = useState(null);

    // Con un horario ya elegido se abre en su día; si el día elegido dejó de existir (otra zona u otra
    // anticipación), se vuelve a elegir.
    useEffect(() => {
        const conCuando = cuando && dias.find((d) => d.isos.includes(cuando));
        if (conCuando) setDia(conCuando.dia);
        else if (dia && !dias.some((d) => d.dia === dia)) setDia(null);
    }, [tzLead, mapa]); // eslint-disable-line react-hooks/exhaustive-deps

    const isos = dias.find((d) => d.dia === dia)?.isos || [];
    const quienesDe = (d) => [...new Set((dias.find((x) => x.dia === d)?.isos || []).flatMap((iso) => mapa[iso] || []))];
    const delDia = quienesDe(dia);
    const superpuestos = isos.filter((iso) => (mapa[iso] || []).length > 1).length;
    const libres = cuando ? mapa[cuando] || [] : [];

    if (dias.length === 0) {
        return (
            <div className="rp-paso">
                <div className="rp-vacio">
                    <CalendarDays size={22} />
                    <b>Sin horarios libres</b>
                    <small>Bajá la anticipación o elegí a otra persona.</small>
                </div>
            </div>
        );
    }

    return (
        <div className="rp-paso">
            <div className="rp-agenda">
                <CalendarioDias dias={dias} tz={tzLead} valor={dia} onElegir={setDia} quienesDe={quienesDe} colorDe={colorDe} />

                <div className="rp-horas-col">
                    {!dia ? (
                        <div className="rp-vacio">
                            <motion.span {...(mov.quieto ? {} : { animate: { y: [0, -4, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } })}>
                                <CalendarDays size={24} />
                            </motion.span>
                            <b>Elegí un día</b>
                        </div>
                    ) : (
                        <motion.div key={dia} className="rp-horas-lista"
                            {...(mov.quieto ? {} : { initial: { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.3, ease: SUAVE } })}>
                            <div className="rp-horas-cab">
                                <div>
                                    <b>{diaLargo(dia)}</b>
                                    <small className="rp-con-bandera"><Bandera c={paisDe(tzLead)} />{`${isos.length} horarios`}</small>
                                </div>
                                <div className="rp-leyenda">
                                    {delDia.map((id) => (
                                        <span key={id} className="rp-leyenda-p" style={{ '--p': colorDe(id) }}>
                                            <i />{persona(id).nombre.split(' ')[0]}
                                        </span>
                                    ))}
                                    {superpuestos > 0 && (
                                        <span className="rp-leyenda-p rp-leyenda-sup" title="Horas con más de una persona libre">
                                            <Layers size={13} />{superpuestos}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {FRANJAS.map((f, fi) => {
                                const deFranja = isos.filter((iso) => franjaDe(iso, tzLead) === f.clave);
                                if (!deFranja.length) return null;
                                const Icono = ICONO_FRANJA[f.clave];
                                return (
                                    <div key={f.clave} className="rp-franja">
                                        <small className="rp-franja-tit"><Icono size={13} />{f.label}</small>
                                        <div className="rp-chips" role="radiogroup" aria-label={`Horas de la ${f.label.toLowerCase()}`}>
                                            {deFranja.map((iso, i) => {
                                                const ids = mapa[iso] || [];
                                                const sel = iso === cuando;
                                                return (
                                                    <motion.button key={iso} type="button" role="radio" aria-checked={sel}
                                                        className="rp-chip" data-sup={ids.length > 1 || undefined}
                                                        title={ids.map((id) => `${persona(id).nombre} · ${horaEn(iso, persona(id).tz)} su hora`).join('\n')}
                                                        onClick={() => onCuando(iso)}
                                                        {...(mov.quieto ? {} : {
                                                            initial: { opacity: 0, scale: 0.9 },
                                                            animate: { opacity: 1, scale: 1 },
                                                            transition: { duration: 0.22, ease: SUAVE, delay: Math.min(fi * 4 + i, 24) * 0.018 },
                                                        })}>
                                                        <b>{horaEn(iso, tzLead)}</b>
                                                        <span className="rp-chip-puntos" aria-hidden="true">
                                                            {ids.map((id) => <i key={id} style={{ background: colorDe(id) }} />)}
                                                        </span>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {cuando && isos.includes(cuando) && (
                                <motion.div key={cuando} className="rp-detalle"
                                    {...(mov.quieto ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, ease: SUAVE } })}>
                                    <span className="rp-detalle-lead">
                                        <Bandera c={paisDe(tzLead)} />
                                        <b>{horaEn(cuando, tzLead)}</b>
                                    </span>
                                    <ArrowRight size={16} className="rp-detalle-flecha" />
                                    <div className="rp-detalle-gente" role={libres.length > 1 ? 'radiogroup' : undefined} aria-label="Con quién">
                                        {libres.map((id) => {
                                            const p = persona(id);
                                            return (
                                                <button key={id} type="button" className="rp-detalle-p" aria-pressed={quien === id}
                                                    style={{ '--p': colorDe(id) }} disabled={libres.length === 1} onClick={() => onQuien(id)}>
                                                    <Avatar name={p.nombre} size="sm" color={colorDe(id)} />
                                                    <span>{p.nombre.split(' ')[0]}</span>
                                                    <em className="rp-con-bandera"><Bandera c={paisDe(p.tz)} titulo={ciudad(p.tz)} />{horaEn(cuando, p.tz)}</em>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {onSiguiente && (
                                        <button type="button" className="btn btn--cta rp-detalle-sig" onClick={onSiguiente}>
                                            Siguiente <ArrowRight size={14} />
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PasoHorario;
