import React, { useEffect, useState } from 'react';
import { Chip, Input, Select } from '../../../standard';
import api from '../../../../services/api';
import { browserTimezone } from '../../../../utils/datetime';
import { SubVista } from '../../piezas';

const enZona = (iso, tz, o) => new Date(iso).toLocaleString('es', { timeZone: tz, ...o });
const DIA = { weekday: 'short', day: 'numeric', month: 'numeric' };
const HORA = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

/**
 * Reprogramar la llamada: con quién y a qué hora, y por qué.
 *
 * Solo se ofrecen horarios libres de esa persona (su horario de Team, sus agendas y su Google), así que no
 * hay choques. Se ven en la hora de quien reprograma y, al elegir uno, también en la del lead (la de su
 * WhatsApp, que se puede cambiar). Con otra persona la llamada se le pasa: de closer a triage, de triage a
 * closer o entre closers.
 */
const SubReprogramar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const apptId = ficha?.identidad?.appointment_id;
    const [datos, setDatos] = useState(null);
    const [persona, setPersona] = useState(null);
    const [cuando, setCuando] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [tzLead, setTzLead] = useState(null);
    const miZona = browserTimezone();

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        setCuando(null);
        api.get(`/ficha/${apptId}/reprogramar/opciones`, { params: persona ? { persona_id: persona } : {} })
            .then((res) => { if (vivo) { setDatos(res.data || {}); setTzLead((t) => t || res.data?.zona_lead?.tz || null); } })
            .catch(() => vivo && setDatos({ error: true }));
        return () => { vivo = false; };
    }, [apptId, persona]);

    const personas = datos?.personas || [];
    const horarios = datos?.horarios || [];
    const dias = horarios.reduce((acc, iso) => {
        const dia = enZona(iso, miZona, DIA);
        (acc[dia] = acc[dia] || []).push(iso);
        return acc;
    }, {});
    const lead = tzLead || miZona;
    const puede = !!cuando && !!datos?.persona_id && motivo.trim().length >= 3 && !guardando;

    return (
        <SubVista titulo="Reprogramar llamada" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!puede}
                    onClick={() => onConfirmar({ inicio: cuando, persona_id: datos.persona_id, motivo: motivo.trim() })}>
                    {guardando ? 'Reprogramando…' : 'Reprogramar'}
                </button>
            )}>
            {datos === null && <small className="t-cap mut">Buscando horarios libres…</small>}
            {datos?.error && <small className="t-cap mut">No se pudieron cargar los horarios. Cerrá y volvé a abrir la ficha.</small>}
            {datos && !datos.error && (
                <div style={{ display: 'grid', gap: 'var(--s4)' }}>
                    <div className="grid-2">
                        <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                            <small className="t-rotulo">¿Con quién?</small>
                            <Select size="sm" label="¿Con quién?" value={String(datos.persona_id || '')}
                                onChange={(v) => setPersona(Number(v))}
                                options={personas.map((p) => ({
                                    value: String(p.id),
                                    label: `${p.nombre} · ${p.rol === 'triage' ? 'triage' : 'closer'}${p.id === datos.actual_id ? ' (la actual)' : ''}`,
                                }))} />
                        </div>
                        <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                            <small className="t-rotulo">Hora del lead</small>
                            <Select size="sm" label="Hora del lead" value={lead} onChange={setTzLead}
                                options={[...((datos.zonas || []).some((z) => z.tz === lead) ? [] : [{ value: lead, label: lead }]),
                                    ...(datos.zonas || []).map((z) => ({ value: z.tz, label: `${z.nombre}${z.tz === datos.zona_lead?.tz ? ' · del lead' : ''}` }))]} />
                        </div>
                    </div>

                    {horarios.length === 0 ? (
                        <small className="t-cap mut">No tiene horarios libres en los próximos días: probá con otra persona.</small>
                    ) : (
                        <div style={{ display: 'grid', gap: 'var(--s2)' }}>
                            <small className="t-cap mut">{`Horas en tu zona (${miZona}). Tocá una.`}</small>
                            {Object.entries(dias).map(([dia, lista]) => (
                                <div key={dia} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    <small className="t-rotulo" style={{ minWidth: 72 }}>{dia}</small>
                                    {lista.map((iso) => (
                                        <Chip key={iso} as="button" type="button" aria-pressed={cuando === iso}
                                            subtle={cuando !== iso} onClick={() => setCuando(iso)}>
                                            {enZona(iso, miZona, HORA)}
                                        </Chip>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {cuando && (
                        <small className="t-sm">
                            {`${enZona(cuando, miZona, { ...DIA, ...HORA })} para vos · `}
                            <b>{`${enZona(cuando, lead, { ...DIA, ...HORA })} para el lead`}</b>
                        </small>
                    )}

                    <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                        <small className="t-rotulo">¿Por qué se reprograma?</small>
                        <Input aria-label="Motivo" value={motivo} placeholder="Ej.: pidió cambiar el horario"
                            onChange={(e) => setMotivo(e.target.value)} />
                    </div>
                </div>
            )}
        </SubVista>
    );
};

export default SubReprogramar;
