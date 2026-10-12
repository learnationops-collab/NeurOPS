// Turnos de la semana para un evento: cuántas sesiones le quedan libres a cada closer y cuántas le
// entran con su horario, encadenadas como las ofrece el sistema (turnos.js). La usan Team › Available
// y la configuración del evento.

import { useMemo } from 'react';
import { DIAS } from '../../core/catalogos';
import { claveDia, fechaCorta } from '../../core/tiempo';
import { reservasDe as _reservasDe } from '../../data/almacen';
import { useDatos, useUi } from '../../data/hooks';
import { Avatar, Icono } from '../../ui/base';
import { setTeam } from './comun';
import { googleDeOcupacion, useAhora, useOcupacionGoogle } from './semana';
import { textoSesion } from './Sesiones';
import { rangoSemana } from './cobertura';
import { turnosSemana } from './turnos';

const AVISO = {
    error: 'No se pudo leer su calendario: puede tener menos libres',
    sin_google: 'Sin Google Calendar: no recibe agendas',
    sin_usuario: 'Sin cuenta en la app: no recibe agendas',
};

export default function TablaTurnos({ evento, personas }) {
    const { reservas } = useDatos();
    const { team } = useUi();
    const ahora = useAhora();
    const semana = team.semana || 0;
    const { desde, hasta } = rangoSemana(personas, semana, ahora);
    const google = useOcupacionGoogle(desde, hasta, personas.length > 0);
    const t = useMemo(() => turnosSemana({
        personas, evento, semana, ahora, reservasDe: (id) => _reservasDe(reservas, id), googleDe: googleDeOcupacion(google),
    }), [personas, evento, semana, ahora, reservas, google]);

    if (!personas.length) return <p className="t-sm mut">Ningún closer tiene horario cargado.</p>;
    const hoyK = claveDia(ahora, t.tz);
    const ir = (v) => setTeam({ semana: v === 0 ? 0 : semana + v });
    return (
        <div className="tu">
            <div className="tu-cab">
                <div className="av-nav">
                    <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Semana anterior" onClick={() => ir(-1)}><Icono n="chevron-left" /></button>
                    <button type="button" className="btn btn--linea btn--sm" data-nav="" disabled={!semana} onClick={() => ir(0)}>Hoy</button>
                    <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Semana siguiente" onClick={() => ir(1)}><Icono n="chevron-right" /></button>
                    <b className="av-rango" aria-live="polite">{fechaCorta(t.claves[0]) + ' – ' + fechaCorta(t.claves[6])}</b>
                </div>
                <p className="tu-total"><b className="num">{t.nLibres}</b> turnos libres <span className="mut">de {t.nTotal}</span>{google == null && <span className="mut"> · leyendo calendarios…</span>}</p>
            </div>
            <div className="tu-scroll">
                <table className="tu-tabla">
                    <thead>
                        <tr>
                            <th scope="col">Closer</th>
                            {t.claves.map(k => {
                                const d = new Date(k + 'T12:00:00Z');
                                return <th key={k} scope="col" className={k === hoyK ? 'tu-hoy' : undefined}>{DIAS[(d.getUTCDay() + 6) % 7].n.slice(0, 3)} <span>{d.getUTCDate()}</span></th>;
                            })}
                            <th scope="col">Libres</th>
                        </tr>
                    </thead>
                    <tbody>
                        {t.filas.map(f => (
                            <tr key={f.p.id}>
                                <th scope="row">
                                    <span className="tu-quien">
                                        <Avatar p={f.p} clase="avatar--sm" />
                                        <span>
                                            <b className="trunc">{f.p.nombre}</b>
                                            <span className="t-sm mut">{textoSesion(f.dur, f.margen)}</span>
                                            {AVISO[f.estado] && <span className="tu-aviso"><Icono n="alerta" s={12} />{AVISO[f.estado]}</span>}
                                        </span>
                                    </span>
                                </th>
                                {f.libres.map((n, i) => (
                                    <td key={t.claves[i]} className={(f.total[i] ? '' : 'tu-nada') + (n ? '' : ' tu-cero')}
                                        data-tip={f.total[i] ? f.p.nombre + '|' + n + ' libres de ' + f.total[i] : undefined}>
                                        {f.total[i] ? <><b className="num">{n}</b><span>/{f.total[i]}</span></> : '–'}
                                    </td>
                                ))}
                                <td className="tu-suma">
                                    <b className="num">{f.nLibres}</b><span>/{f.nTotal}</span>
                                    <i className="av-barra"><i style={{ width: (f.nTotal ? f.nLibres / f.nTotal * 100 : 0) + '%' }} /></i>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
