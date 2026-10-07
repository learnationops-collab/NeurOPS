// Último paso del lead: día y horario, en su zona horaria. Port de rvCalendarioHTML.
// Solo se puede ir a meses con horarios; los días sin horarios quedan deshabilitados.

import { useEffect } from 'react';

import { ZONAS, zonaInfo } from '../core/catalogos';
import { claveDia, fechaClave, fechaTs, gmtTxt, horaTxt, mesTitulo } from '../core/tiempo';
import { mayus, pad } from '../core/util';
import { Bandera, Icono, MeetLogo } from '../ui/base';

const SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

// Horarios agrupados por día (clave YYYY-MM-DD en la zona del lead).
export function diasDeSlots(slots, tz) {
    const dias = {};
    slots.forEach(x => { const k = claveDia(x.t, tz); (dias[k] = dias[k] || []).push(x); });
    return dias;
}

// Día que se muestra: el elegido; si no, el primero con horarios del mes visible (o el primero de todos).
export function diaEfectivo(s, dias, keys) {
    if (s.dia && dias[s.dia]) return s.dia;
    if (s.mes) return keys.find(k => k.slice(0, 7) === s.mes) || null;
    return keys[0] || null;
}

export function mesEfectivo(s, dia, tz) { return s.mes || (dia || claveHoy(tz)).slice(0, 7); }
function claveHoy(tz) { return claveDia(Date.now(), tz); }

/**
 * acc: {alternarZona, elegirTz, cambiarMes, elegirDia, elegirHora, confirmar}
 * envio: {enviando, error, yaTiene} solo en el link público. yaTiene: {inicio, hora} cuando el lead ya
 * tiene otra agenda próxima: se le pregunta si la cambia a este horario o suma una sesión.
 * asig null: los horarios todavía no llegaron (buscando) o no se pudieron traer (errorHorarios, con
 * acc.reintentarHorarios). Con asig y buscando, se siguen mostrando los anteriores hasta que lleguen los nuevos.
 */
export default function PasoCalendario({ s, asig, nombre, ids, dur, tzFija, aviso, envio, acc, buscando = false, errorHorarios = '' }) {
    const tz = s.tz, z = zonaInfo(tz);
    // Al elegir la hora, que se vea el «Confirmar»: en el celular queda debajo de la lista de horas.
    useEffect(() => {
        if (s.hora == null) return;
        const btn = document.querySelector('[data-rv="confirmar"]');
        if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [s.hora]);
    const slots = asig ? asig.slots : [];
    const dias = diasDeSlots(slots, tz);
    const keys = Object.keys(dias).sort();
    const dia = diaEfectivo(s, dias, keys);
    const mes = mesEfectivo(s, dia, tz);
    const hora = s.hora != null && slots.some(x => x.t === s.hora) ? s.hora : null;

    let cal = null;
    if (!asig && errorHorarios) {
        cal = (
            <div className="rv-cal">
                <div>
                    <p className="rv-err" role="alert"><Icono n="alerta" s={16} /><span>{errorHorarios}</span></p>
                    <button type="button" className="rv-link" onClick={acc.reintentarHorarios}>Buscar de nuevo</button>
                </div>
            </div>
        );
    } else if (!asig) {
        // Mismo lugar que ocupa el calendario, para que no salte la pantalla cuando llegan los horarios.
        cal = (
            <div className="rv-cal" aria-busy="true" style={{ minHeight: 320 }}>
                <p className="rv-ayuda" role="status">Buscando horarios…</p>
            </div>
        );
    } else if (!keys.length) {
        cal = <p className="rv-ayuda">No hay horarios en las próximas semanas.</p>;
    } else {
        const [y, m1] = mes.split('-').map(Number), m = m1 - 1;
        const off = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const hoy = claveHoy(tz), minM = keys[0].slice(0, 7), maxM = keys[keys.length - 1].slice(0, 7);
        const celdas = [];
        for (let i = 0; i < off; i++) celdas.push(<span key={'v' + i} />);
        for (let dd = 1; dd <= n; dd++) {
            const k = y + '-' + pad(m + 1) + '-' + pad(dd), c = dias[k] ? dias[k].length : 0;
            celdas.push(
                <button key={k} type="button" className="rv-dia" data-k={k} disabled={!c} aria-pressed={k === dia}
                    aria-label={fechaClave(k) + (c ? ', ' + c + ' horarios' : ', sin horarios')} onClick={() => acc.elegirDia(k)}>
                    {dd}{k === hoy && <i aria-hidden="true" />}
                </button>,
            );
        }
        const hs = (dia && dias[dia]) || [];
        cal = (
            <div className="rv-cal" aria-busy={buscando ? true : undefined} style={buscando ? { opacity: 0.6, transition: 'opacity .2s' } : undefined}>
                <div>
                    <div className="rv-mes-cab">
                        <button type="button" className="rv-navbtn" data-mes="-1" aria-label="Mes anterior" disabled={mes <= minM} onClick={() => acc.cambiarMes(mes, -1)}>
                            <Icono n="chevron-left" s={18} />
                        </button>
                        <b className="rv-mes-tit">{mesTitulo(y, m)}</b>
                        <button type="button" className="rv-navbtn" data-mes="1" aria-label="Mes siguiente" disabled={mes >= maxM} onClick={() => acc.cambiarMes(mes, 1)}>
                            <Icono n="chevron-right" s={18} />
                        </button>
                    </div>
                    <div className="rv-sem">
                        {SEMANA.map(x => <span key={x} aria-hidden="true">{x}</span>)}
                        {celdas}
                    </div>
                </div>
                <div className="rv-horas">
                    <p className="rv-dia-tit">{dia ? fechaClave(dia) : 'Elegí un día'}</p>
                    {hs.length > 0 && (
                        <div className="rv-horas-lista" role="group" aria-label="Horarios">
                            {hs.map(x => (
                                <button key={x.t} type="button" className="rv-hora" data-t={x.t} aria-pressed={x.t === hora} onClick={() => acc.elegirHora(x.t)}>
                                    {horaTxt(x.t, tz)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="rv-paso rv-paso--entra">
            <h1 className="rv-q rv-q--l1" id={ids.q}>{(nombre ? nombre + ', elegí' : 'Elegí') + ' día y horario'}</h1>
            <div className="rv-info">
                <span><Icono n="clock" s={16} />{dur} min</span>
                <span><MeetLogo />Google Meet</span>
            </div>
            <div className="rv-tzbar">
                <Icono n={tzFija ? 'candado' : 'globo'} s={16} />
                <span>{z.c && <Bandera c={z.c} />}<b>{mayus(z.largo)}</b> · {gmtTxt(tz)}</span>
                {!tzFija && <button type="button" className="rv-link" aria-expanded={s.zonaAbierta} onClick={acc.alternarZona}>Cambiar</button>}
                {s.zonaAbierta && (
                    <div className="rv-zpop" role="listbox" aria-label="Zona horaria">
                        {ZONAS.map(zz => (
                            <button key={zz.tz} type="button" className="rv-pais-op" role="option" aria-selected={zz.tz === tz} onClick={() => acc.elegirTz(zz.tz)}>
                                <Bandera c={zz.c} /><span>{zz.n}</span><span>{gmtTxt(zz.tz)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {aviso && <div className="rv-zona"><Icono n="alerta" s={16} /><span>{aviso}</span></div>}
            {cal}
            {envio && envio.error && (
                <p key={envio.n} className="rv-err rv-sacude" role="alert"><Icono n="alerta" s={16} /><span>{envio.error}</span></p>
            )}
            {envio && envio.yaTiene && envio.yaTiene.hora === hora ? (
                <div className="rv-yatiene" role="alertdialog" aria-labelledby={ids + '-yatiene'}>
                    <p id={ids + '-yatiene'}>
                        Vemos que ya tenés una sesión agendada para el <b>{fechaTs(envio.yaTiene.inicio, tz)}</b> a las {horaTxt(envio.yaTiene.inicio, tz)}.
                        ¿Querías cambiarla a este nuevo horario o te gustaría tener una sesión adicional?
                    </p>
                    <div className="rv-acc">
                        <button type="button" className="rv-seguir" data-rv="confirmar" disabled={!!envio.enviando} onClick={() => acc.confirmar(hora, 'reprogramar')}>
                            Cambiar la fecha<Icono n="check" s={18} />
                        </button>
                        <button type="button" className="rv-link" disabled={!!envio.enviando} onClick={() => acc.confirmar(hora, 'adicional')}>
                            Quiero una sesión adicional
                        </button>
                    </div>
                </div>
            ) : hora != null && (
                <div className="rv-acc">
                    <button type="button" className="rv-seguir" data-rv="confirmar" disabled={!!(envio && envio.enviando)} aria-busy={envio && envio.enviando ? true : undefined}
                        onClick={() => acc.confirmar(hora)}>
                        {envio && envio.enviando ? 'Agendando…' : 'Confirmar'}<Icono n="check" s={18} />
                    </button>
                    <span className="rv-enter"><b>{fechaTs(hora, tz)}</b>&nbsp;· {horaTxt(hora, tz)}</span>
                </div>
            )}
        </div>
    );
}
