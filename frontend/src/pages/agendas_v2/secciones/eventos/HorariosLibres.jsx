// Horarios libres del evento con la configuración que se está editando (el borrador, sin publicar):
// los inicios que hoy le quedan a cada closer del evento, con su sesión, la antelación, hasta cuándo
// reserva, sus agendas, su Google Calendar y su tope de llamadas por semana. Por día, en la zona de quien mira.

import { useMemo, useState } from 'react';
import { TZ_DEF } from '../../core/catalogos';
import { sesionDe } from '../../core/datos';
import { agendaOpt, seSolapa, slotsPersona } from '../../core/disponibilidad';
import { claveDia, fechaClave, gmtTxt, horaTxt, semanaDe } from '../../core/tiempo';
import { useDatos } from '../../data/hooks';
import { Avatar, HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { agendasDeVista, googleDeOcupacion, useAhora, useOcupacionGoogle, useZonaVista } from '../team/semana';
import { Modal, ModalHeader } from '../../../../components/standard';

const DIA = 86400000;
// Lo ocupado en Google se lee hasta 10 días (el tope del servidor): no se muestra más allá.
const VENTANA_DIAS = 10;
const DIAS_VISTA = 7;

/**
 * {dias: [{clave, slots: [{t, ps}]}], nPersonas}. Un horario junta a todos los closers libres a esa hora.
 * o: {evento, personas, ahora, reservasDe(id), googleDe(id), tz}
 */
export function horariosLibres({ evento, personas, ahora, reservasDe, googleDe, tz }) {
    const o = agendaOpt(evento, evento.duracion), hasta = ahora + VENTANA_DIAS * DIA;
    const porT = new Map();
    personas.forEach(p => {
        const [dur, margen] = sesionDe(p, evento.id, evento.duracion, evento.margen);
        const g = googleDe(p.id), rs = reservasDe(p.id);
        const ocupado = rs
            .map(r => ({ inicio: r.inicio_ms, fin: (r.fin_ms != null ? r.fin_ms : r.inicio_ms + 3600000) + (r.margen_min || 0) * 60000 }))
            .concat(g && g.estado === 'ok' ? (g.franjas || []).map(f => ({ inicio: f[0], fin: f[1] })) : []);
        let ts = slotsPersona(p, dur, o, { ahora, margen, ocupado: (pid, t, largo) => seSolapa(ocupado, t, largo) }).filter(t => t < hasta);
        // Con tope de llamadas por semana, una semana llena no ofrece horarios (como asignacion.js).
        const tope = p.llamadas_semana || 0, ptz = p.tz || TZ_DEF;
        if (tope) ts = ts.filter(t => rs.filter(r => semanaDe(r.inicio_ms, ptz) === semanaDe(t, ptz)).length < tope);
        ts.forEach(t => { if (!porT.has(t)) porT.set(t, []); porT.get(t).push(p); });
    });
    const dias = [];
    [...porT.keys()].sort((a, b) => a - b).forEach(t => {
        const clave = claveDia(t, tz);
        let dia = dias[dias.length - 1];
        if (!dia || dia.clave !== clave) { if (dias.length === DIAS_VISTA) return; dias.push(dia = { clave, slots: [] }); }
        dia.slots.push({ t, ps: porT.get(t) });
    });
    return { dias, nPersonas: personas.length };
}

export default function HorariosLibres({ e, personas, onCerrar }) {
    const { reservas } = useDatos();
    const ahora = useAhora();
    const tz = useZonaVista() || TZ_DEF;
    // La ventana de Google queda fija mientras la ventana está abierta (se renueva sola cada 2 minutos).
    const [desde] = useState(() => Date.now());
    const google = useOcupacionGoogle(desde, desde + VENTANA_DIAS * DIA, personas.length > 0);
    const r = useMemo(() => horariosLibres({
        evento: e, personas, ahora, reservasDe: agendasDeVista(reservas, google).ocupan, googleDe: googleDeOcupacion(google), tz,
    }), [e, personas, ahora, reservas, google, tz]);
    const hoy = claveDia(ahora, tz), manana = claveDia(ahora + DIA, tz);
    const total = r.dias.reduce((n, d) => n + d.slots.length, 0);
    const primero = total ? r.dias[0].slots[0].t : null;
    return (
        <Modal onClose={onCerrar} className="modal--hl" labelledBy="hl-tit">
            <Humo clase="humo--tarjeta humo--suave" cols={HUMO_MARCA} />
            <ModalHeader icon={<span className="icono-m"><Icono n="calendar" s={18} /></span>} title="Horarios libres ahora" titleId="hl-tit"
                subtitle={'Con esta configuración, aunque no esté publicada · tu hora (' + gmtTxt(tz) + ')'}
                onClose={onCerrar} closeProps={{ 'data-nav': '' }} />
            <p className="t-sm mut hl-nota">
                {e.persona ? 'Solo la persona fija del evento.' : 'Todos los closers del evento con horario: según la segmentación, un lead puede ver solo los de su prioridad.'}
                {' '}Descuenta sus agendas y su Google Calendar.
                {google == null && <> Leyendo calendarios…</>}
                {google === 'error' && <> No se pudieron leer los calendarios: puede haber menos libres.</>}
            </p>
            {!r.nPersonas ? <p className="t-sm mut">Ningún closer tiene horario cargado.</p>
                : !total ? <p className="t-sm mut">No queda ningún horario libre en los próximos {VENTANA_DIAS} días con esta configuración.</p> : (
                    <div className="hl-dias">
                        {r.dias.map(d => (
                            <section key={d.clave} className="hl-dia">
                                <h3 className="hl-dia-tit">
                                    {d === r.dias[0] && <span className="hl-punto" aria-hidden="true" />}
                                    {d.clave === hoy ? 'Hoy' : d.clave === manana ? 'Mañana' : fechaClave(d.clave)}
                                    <span className="mut">{d.slots.length}</span>
                                </h3>
                                <div className="hl-horas">
                                    {d.slots.map(s => (
                                        <span key={s.t} className={'hl-hora' + (s.t === primero ? ' hl-hora--prox' : '')} title={s.ps.map(p => p.nombre).join(', ')}>
                                            {s.t === primero && <Humo clase="humo--suave" cols={HUMO_MARCA} />}
                                            <b className="num">{horaTxt(s.t, tz)}</b>
                                            {r.nPersonas > 1 && (
                                                <span className="hl-ps">
                                                    {s.ps.slice(0, 3).map(p => <Avatar key={p.id} p={p} clase="avatar--xs" />)}
                                                    {s.ps.length > 3 && <span className="mut">+{s.ps.length - 3}</span>}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
        </Modal>
    );
}
