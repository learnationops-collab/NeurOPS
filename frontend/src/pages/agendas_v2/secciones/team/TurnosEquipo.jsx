// Turnos que quedan, de un vistazo (Estrategia 16/11, Leadership 1397): por día de la semana, cuántas
// llamadas le quedan libres al triage (Sesión Diagnóstica) y a los closers (Sesión de Aceleración), sumadas
// entre las personas de cada grupo y encadenadas como las ofrece el link (turnos.js). Al pasar el mouse,
// cuántos tiene cada uno; «Por persona» abre la tabla de cada grupo. Va arriba de Team › Available, que es
// lo que abre el setter con el botón Tálamus. Usa lo que ya leyó Available (agendas y Google).

import { useMemo, useState } from 'react';
import { DIAS } from '../../core/catalogos';
import { buscar, esCloser, esTriage, horasSemana, ord } from '../../core/datos';
import { claveDia, fechaCorta, horaTxt } from '../../core/tiempo';
import { useDatos } from '../../data/hooks';
import { googleDeOcupacion } from './semana';
import { turnosSemana } from './turnos';
import TablaTurnos from './Turnos.jsx';
import { Button } from '../../../../components/standard';

const GRUPOS = [
    { key: 'triage', nombre: 'Triage', evento: 'sesion-diagnostica', de: (d, p) => esTriage(d, p) },
    { key: 'closers', nombre: 'Closers', evento: 'sesion-de-aceleracion', de: (d, p) => esCloser(d, p) && !esTriage(d, p) },
];

// Solo las personas que la reserva ofrece (usuario activo, Google y WhatsApp: servicio.solo_elegibles);
// sin el dato (modo local), todas.
export const ofrecidas = (personas, elegibles) => (elegibles ? personas.filter(p => elegibles.includes(p.id)) : personas);

// Los horarios libres de un grupo en un día: cada hora con quiénes la tienen.
function horariosDe(g, k, tz) {
    const porHora = new Map();
    g.t.filas.forEach(f => f.inicios.filter(t => claveDia(t, tz) === k).forEach(t => {
        porHora.set(t, [...(porHora.get(t) || []), f.p.nombre]);
    }));
    return [...porHora.entries()].sort((a, b) => a[0] - b[0]);
}

export default function TurnosEquipo({ vista, google, semana, ahora, tz }) {
    const { d, elegibles } = useDatos();
    const [abierto, setAbierto] = useState(false);
    const [elegido, setElegido] = useState(null);
    const grupos = useMemo(() => GRUPOS.map(g => {
        const evento = buscar(d, 'eventos', g.evento);
        const personas = ofrecidas(ord(d, 'personas'), elegibles).filter(p => g.de(d, p) && horasSemana(p) > 0);
        const t = evento && personas.length ? turnosSemana({
            personas, evento, semana, ahora, reservasDe: vista.ocupan, googleDe: googleDeOcupacion(google), tz,
        }) : null;
        return { ...g, eventoObj: evento, personas, t };
    }), [d, elegibles, vista, google, semana, ahora, tz]);

    const base = grupos.find(g => g.t);
    if (!base) return null;
    const claves = base.t.claves;
    const hoyK = claveDia(ahora, base.t.tz);
    const pasado = (k) => k < hoyK;
    const porPersona = (g, i) => g.t.filas.filter(f => f.libres[i]).map(f => f.p.nombre + ' ' + f.libres[i]).join(' · ') || 'Nadie tiene turnos libres';

    return (
        <div className="tu tu--equipo">
            <div className="tu-cab">
                <b>Turnos que quedan</b>
                <span className="t-sm mut">{google == null ? 'Leyendo calendarios…' : 'Llamadas que todavía se pueden agendar, por día'}</span>
                <Button size="sm" data-nav="" onClick={() => setAbierto(v => !v)}>{abierto ? 'Ocultar por persona' : 'Por persona'}</Button>
            </div>
            <div className="tu-scroll">
                <table className="tu-tabla">
                    <thead>
                        <tr>
                            <th scope="col">Grupo</th>
                            {claves.map(k => {
                                const dd = new Date(k + 'T12:00:00Z');
                                return <th key={k} scope="col" className={k === hoyK ? 'tu-hoy' : undefined}>{DIAS[(dd.getUTCDay() + 6) % 7].n.slice(0, 3)} <span>{dd.getUTCDate()}</span></th>;
                            })}
                            <th scope="col">Semana</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grupos.filter(g => g.t).map(g => (
                            <tr key={g.key}>
                                <th scope="row"><b>{g.nombre}</b> <span className="t-sm mut">{g.personas.length}</span></th>
                                {claves.map((k, i) => {
                                    const libres = g.t.filas.reduce((s, f) => s + f.libres[i], 0);
                                    const total = g.t.filas.reduce((s, f) => s + f.total[i], 0);
                                    if (!total || pasado(k)) return <td key={k} className="tu-nada">–</td>;
                                    const esta = elegido && elegido.g === g.key && elegido.k === k;
                                    return (
                                        <td key={k} className={[libres ? '' : 'tu-cero', esta ? 'tu-elegido' : ''].join(' ').trim() || undefined}
                                            data-tip={g.nombre + ': ' + libres + ' libres|' + porPersona(g, i)}>
                                            <button type="button" className="tu-celda" data-nav="" disabled={!libres} aria-pressed={!!esta}
                                                aria-label={`Ver los horarios libres de ${g.nombre} el ${fechaCorta(k)}`}
                                                onClick={() => setElegido(esta ? null : { g: g.key, k })}>
                                                <b className="num">{libres}</b>
                                            </button>
                                        </td>
                                    );
                                })}
                                <td className="tu-suma"><b className="num">{g.t.nLibres}</b></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {(() => {
                const g = elegido && grupos.find(x => x.key === elegido.g && x.t);
                if (!g) return <p className="t-sm mut tu-pista">Tocá un número para ver los horarios de ese día.</p>;
                const horas = horariosDe(g, elegido.k, base.t.tz);
                return (
                    <div className="tu-horarios">
                        <b className="t-sm">{g.nombre} · {fechaCorta(elegido.k)}</b>
                        {horas.length ? (
                            <div className="tu-horas">
                                {horas.map(([t, quienes]) => (
                                    <span key={t} className="tu-hora" data-tip={quienes.join(' · ')}>
                                        <b className="num">{horaTxt(t, base.t.tz)}</b>
                                        {quienes.length > 1 && <small>×{quienes.length}</small>}
                                    </span>
                                ))}
                            </div>
                        ) : <span className="t-sm mut">No quedan horarios ese día.</span>}
                    </div>
                );
            })()}
            {abierto && grupos.filter(g => g.t).map(g => (
                <div key={g.key} className="tu-detalle">
                    <b className="t-sm">{g.nombre}</b>
                    <TablaTurnos evento={g.eventoObj} personas={g.personas} />
                </div>
            ))}
        </div>
    );
}
