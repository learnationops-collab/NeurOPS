// Available: calendario semanal de cobertura. Cada closer es un carril; dentro de su horario,
// lleno = agendada (reservas reales), claro = libre. Rayado = franja del día sin ningún closer.
// Con una sola persona y permiso, se edita arrastrando: crear, mover y estirar franjas (de a 30 min).

import { useEffect, useMemo, useRef, useState } from 'react';
import { closers, colorVar, horasSemana } from '../../core/datos';
import { puedeHorarioDe } from '../../core/permisos';
import { fechaCorta, gmtTxt, horaTxt } from '../../core/tiempo';
import { clonar, fmt, iniciales, mayus, pad } from '../../core/util';
import { reservasDe as _reservasDe } from '../../data/almacen';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { toast } from '../../ui/toast';
import { DIAS } from '../../core/catalogos';
import { HPX, avUnir, calcularCobertura, hmTxt, nombreDia } from './cobertura';
import { setTeam } from './comun';

const hm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

// Hora actual, que se renueva cada minuto para mover la línea de "ahora".
function useAhora() {
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60000); return () => clearInterval(t); }, []);
    return ahora;
}

export default function Available({ solo = null }) {
    const { d, perfil, reservas } = useDatos();
    const { sim, team } = useUi();
    const ahora = useAhora();
    const edit = !!solo && puedeHorarioDe(d, sim, perfil, solo);
    const semana = team.semana || 0;
    const todos = useMemo(() => closers(d).filter(p => horasSemana(p) > 0), [d]);
    const cs = useMemo(() => (solo ? (horasSemana(solo) > 0 || edit ? [solo] : []) : todos), [solo, edit, todos]);

    const cob = useMemo(() => (cs.length ? calcularCobertura({
        todos, cs, semana, ahora, edit, reservasDe: (id) => _reservasDe(reservas, id),
    }) : null), [todos, cs, semana, ahora, edit, reservas]);

    const [arr, setArr] = useState(null);   // franja que se está arrastrando: {dow, ri, a, b, modo}
    const drag = useRef(null);

    if (!cob) {
        return <div className="panel vacio"><p className="t-sm mut">{solo ? 'Cargá tu horario para ver tu semana.' : 'Cargá horarios en People para ver la cobertura.'}</p></div>;
    }
    const { tz, dias, bloques, huecos, porDia, minH, maxH, hoyK, mAhora, kpi } = cob;
    const n = cs.length, alto = (maxH - minH) * HPX;
    const rango = fechaCorta(dias[0].k) + ' – ' + fechaCorta(dias[6].k);
    const y = (m) => (m - minH * 60) / 60 * HPX;

    // Minuto del día bajo el puntero, redondeado a 30 min y dentro de la grilla.
    const minDe = (col, cy) => {
        const r = col.getBoundingClientRect();
        return Math.max(minH * 60, Math.min(maxH * 60, Math.round(((cy - r.top) / HPX * 60 + minH * 60) / 30) * 30));
    };

    const guardar = (D) => {
        const p = solo && almacen.getState().d.personas.find(x => x.id === solo.id);
        if (!p) return;
        const hz = clonar(p.horario), dia = hz[D.dow] || [];
        if (D.modo === 'crear') dia.push([hmTxt(D.a), hmTxt(D.b)]); else if (dia[D.ri]) dia[D.ri] = [hmTxt(D.a), hmTxt(D.b)];
        hz[D.dow] = avUnir(dia);
        almacen.editar('personas', p.id, { horario: hz }, true);
        toast(mayus(nombreDia(D.dow)) + ' ' + hmTxt(D.a) + '–' + hmTxt(D.b));
    };

    const empezar = (e, dow, bl) => {
        if (!edit || e.button > 0 || e.target.closest('.av-del')) return;
        const col = e.currentTarget, m = minDe(col, e.clientY);
        const D = { dow, col, start: m, movio: false };
        if (bl) {
            const asa = e.target.dataset.av;
            Object.assign(D, { modo: asa === 't' ? 'top' : asa === 'b' ? 'bot' : 'mover', ri: bl.ri, a0: bl.m0, b0: bl.m1, a: bl.m0, b: bl.m1 });
        } else Object.assign(D, { modo: 'crear', a: m, b: Math.min(1440, m + 60) });
        e.preventDefault();
        drag.current = D;
        setArr({ ...D, col: undefined });
        const mover = (ev) => {
            const X = drag.current; if (!X) return;
            const mm = minDe(X.col, ev.clientY);
            if (mm !== X.start) X.movio = true;
            if (X.modo === 'crear') { X.a = Math.min(X.start, mm); X.b = Math.max(X.start, mm); if (X.b - X.a < 30) X.b = Math.min(1440, X.a + (X.movio ? 30 : 60)); }
            else if (X.modo === 'top') X.a = Math.min(mm, X.b - 30);
            else if (X.modo === 'bot') X.b = Math.max(mm, X.a + 30);
            else { const dd = Math.max(-X.a0, Math.min(1440 - X.b0, mm - X.start)); X.a = X.a0 + dd; X.b = X.b0 + dd; }
            setArr({ dow: X.dow, ri: X.ri, a: X.a, b: X.b, modo: X.modo });
        };
        const fin = () => {
            document.removeEventListener('pointermove', mover);
            document.removeEventListener('pointerup', fin);
            document.removeEventListener('pointercancel', fin);
            const X = drag.current; drag.current = null; setArr(null);
            if (!X || (X.modo !== 'crear' && !X.movio)) return;
            guardar(X);
        };
        document.addEventListener('pointermove', mover);
        document.addEventListener('pointerup', fin);
        document.addEventListener('pointercancel', fin);
    };

    const quitar = (bl) => {
        const p = almacen.getState().d.personas.find(x => x.id === solo.id);
        if (!p) return;
        const hz = clonar(p.horario);
        hz[bl.dow].splice(bl.ri, 1);
        almacen.editar('personas', p.id, { horario: hz }, true);
        toast(mayus(nombreDia(bl.dow)) + ' ' + horaTxt(bl.t0, tz) + '–' + horaTxt(bl.t1, tz) + ' quitado');
    };

    const irSemana = (v) => setTeam({ semana: v === 0 ? 0 : semana + v });
    const ocupPct = Math.round(kpi.ocupacion * 100);

    return (
        <>
            <div className="av-kpis">
                <div className="av-kpi"><span>{solo ? 'Tus horas' : 'Horas disponibles'}</span><b className="num">{fmt(kpi.hDisp, 0)}</b></div>
                <div className="av-kpi"><span>Agendadas</span><b className="num">{kpi.agendadas}<em>/{kpi.celdas}</em></b></div>
                <div className="av-kpi"><span>Ocupación</span><b className="num">{ocupPct}%</b><i className="av-barra"><i style={{ width: kpi.ocupacion * 100 + '%' }} /></i></div>
                <div className="av-kpi av-kpi--hueco"><span>{solo ? 'Huecos del equipo' : 'Sin closer'}</span><b className="num">{fmt(kpi.hHueco, 0)} h</b></div>
            </div>
            <section className={'av caja' + (edit ? ' av--edit' : '')}>
                <Humo clase="humo--tarjeta humo--suave" cols={HUMO_MARCA} />
                <div className="av-barra-sup">
                    <div className="av-nav">
                        <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Semana anterior" onClick={() => irSemana(-1)}><Icono n="chevron-left" /></button>
                        <button type="button" className="btn btn--linea btn--sm" data-nav="" disabled={!semana} onClick={() => irSemana(0)}>Hoy</button>
                        <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Semana siguiente" onClick={() => irSemana(1)}><Icono n="chevron-right" /></button>
                        <b className="av-rango" aria-live="polite">{rango}</b>
                    </div>
                    <div className="av-ley">
                        {cs.map(p => <span key={p.id} style={{ '--c': colorVar(p.color) }}><i />{p.nombre}</span>)}
                        {edit && <span className="av-ley-s av-ley-edit"><Icono n="edit" s={12} />Arrastrá para crear o mover · se repite cada semana</span>}
                        <span className="av-ley-s"><i className="av-l-ag" />Agendada</span>
                        <span className="av-ley-s"><i className="av-l-li" />Libre</span>
                        <span className="av-ley-s"><i className="av-l-hu" />Sin closer</span>
                    </div>
                </div>
                <div className="av-cal">
                    <div className="av-cab">
                        <span className="av-tz">{gmtTxt(tz, ahora)}</span>
                        {dias.map((dd, di) => {
                            const pd = porDia[di], esHoy = dd.k === hoyK;
                            return (
                                <div key={dd.k} className={'av-dia' + (esHoy ? ' av-dia--hoy' : '')}>
                                    <span>{DIAS[(dd.d.getUTCDay() + 6) % 7].n.slice(0, 3)}</span><b>{dd.d.getUTCDate()}</b>
                                    <em>{pd.t ? Math.round(pd.a / pd.t * 100) + '%' : '—'}</em>
                                </div>
                            );
                        })}
                    </div>
                    <div className="av-cuerpo" style={{ height: alto }}>
                        <div className="av-horas">
                            {Array.from({ length: maxH - minH }, (_, i) => <span key={i} style={{ top: i * HPX }}>{pad(minH + i)}:00</span>)}
                        </div>
                        <div className="av-grilla" style={{ '--hpx': HPX + 'px' }}>
                            {dias.map((dd, di) => {
                                const esHoy = dd.k === hoyK, dow = dd.d.getUTCDay();
                                const bls = bloques.filter(x => x.di === di);
                                const enArr = arr && arr.dow === dow;
                                return (
                                    <div key={dd.k} className={'av-col' + (esHoy ? ' av-col--hoy' : '')}
                                        onPointerDown={edit ? (e => { const el = e.target.closest('.av-bloque'); empezar(e, dow, el ? bls[+el.dataset.i] : null); }) : undefined}>
                                        {huecos.filter(x => x.di === di).map(x => (
                                            <div key={x.m0} className="av-hueco" style={{ top: y(x.m0), height: (x.m1 - x.m0) / 60 * HPX }} data-tip={'Sin closer|' + hm(x.m0) + ' a ' + hm(x.m1)} />
                                        ))}
                                        {bls.map((x, i) => {
                                            const ag = x.celdas.filter(c => c.oc).length;
                                            const vivo = enArr && arr.modo !== 'crear' && arr.ri === x.ri;
                                            const m0 = vivo ? arr.a : x.m0, m1 = vivo ? arr.b : x.m1;
                                            const txtH = vivo ? hmTxt(m0) + '–' + hmTxt(m1) : horaTxt(x.t0, tz) + '–' + horaTxt(x.t1, tz);
                                            return (
                                                <div key={x.p.id + '-' + x.dow + '-' + x.ri} data-i={i} className={'av-bloque' + (vivo ? ' av-bloque--drag' : '')}
                                                    style={{ '--c': colorVar(x.p.color), top: y(m0), height: (m1 - m0) / 60 * HPX, left: 'calc(' + (x.li / n * 100) + '% + 2px)', width: 'calc(' + (100 / n) + '% - 4px)' }}
                                                    data-tip={x.p.nombre + ' · ' + horaTxt(x.t0, tz) + '–' + horaTxt(x.t1, tz) + '|' + ag + ' agendadas de ' + x.celdas.length}>
                                                    {edit ? (
                                                        <>
                                                            <span className="av-asa av-asa--t" data-av="t" />
                                                            <span className="av-asa av-asa--b" data-av="b" />
                                                            <button type="button" className="av-del" aria-label={'Quitar ' + txtH} onClick={() => quitar(x)}><Icono n="x" s={11} /></button>
                                                            <span className="av-hora">{txtH}</span>
                                                        </>
                                                    ) : <span className="av-ini">{iniciales(x.p.nombre)}</span>}
                                                    {!vivo && x.celdas.map(c => (
                                                        <i key={c.t} className={(c.oc ? 'oc' : '') + (c.t + 45 * 60000 < ahora ? ' pas' : '')}
                                                            style={{ top: (c.t - x.t0) / 3600000 * HPX, height: HPX * 45 / 60 }} />
                                                    ))}
                                                </div>
                                            );
                                        })}
                                        {enArr && arr.modo === 'crear' && (
                                            <div className="av-bloque av-ghost" style={{ left: 2, right: 2, top: y(arr.a), height: (arr.b - arr.a) / 60 * HPX, '--c': colorVar(solo.color) }}>
                                                <span className="av-hora">{hmTxt(arr.a) + '–' + hmTxt(arr.b)}</span>
                                            </div>
                                        )}
                                        {esHoy && mAhora >= minH * 60 && mAhora <= maxH * 60 && <div className="av-ahora" style={{ top: y(mAhora) }} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
