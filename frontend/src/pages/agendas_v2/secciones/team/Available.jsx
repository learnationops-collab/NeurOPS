// Available: calendario semanal de cobertura. Cada agenda, margen y evento de su Google Calendar es una
// tarjeta, y los turnos libres del evento elegido (encadenados con su sesión, turnos.js) son tarjetas
// «Libre»: verde con un check lo libre, azul con un teléfono las llamadas, un reloj lo ocupado por otro
// evento. Con varios closers se agrupan como cartas (tarjetas.js): cada día es una columna con todas las
// tarjetas, una por turno, y lo que se pisa queda encimado (lo ocupado atrás, lo libre adelante), con el
// primer nombre del closer y el detalle al pasar el mouse; sin agrupar, cada closer es un carril.
// Rayado rojo = franja del día sin ningún closer. Se filtra por closer y por tipo de tarjeta.
// Con una sola persona y permiso, se edita arrastrando: crear, mover y estirar franjas (de a 30 min).

import { useMemo, useRef, useState } from 'react';
import { closers, colorVar, horasSemana } from '../../core/datos';
import { puedeHorarioDe } from '../../core/permisos';
import { fechaCorta, gmtTxt, horaTxt } from '../../core/tiempo';
import { clonar, fmt, mayus, pad } from '../../core/util';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { HUMO_MARCA, Humo, Icono, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import { DIAS } from '../../core/catalogos';
import { HPX, avUnir, calcularCobertura, durTxt, hmTxt, huecosLibres, nombreDia, rangoSemana } from './cobertura';
import { setTeam } from './comun';
import { agendasDeVista, googleDeOcupacion, useAhora, useOcupacionGoogle, useZonaVista } from './semana';
import { VISUAL, apilar, primerNombre } from './tarjetas';
import { gruposDeSesion, turnosSemana } from './turnos';

const hm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);


// El detalle de un bloque: cuánto de lo disponible está ocupado y en qué.
function resumenBloque(x) {
    const ag = x.mAg + x.mMg ? durTxt(x.mAg + x.mMg) + ' agendado' + (x.mMg ? ' (' + durTxt(x.mMg) + ' de margen)' : '') : '';
    if (x.sinLeer) return 'No se pudo leer su calendario' + (ag ? ' · ' + ag : '');
    const partes = [ag, x.mEv ? durTxt(x.mEv) + ' por eventos' : ''].filter(Boolean);
    return durTxt(x.mAg + x.mMg + x.mEv) + ' ocupado de ' + durTxt(x.mDisp) + (partes.length ? ' · ' + partes.join(' · ') : '');
}

const nombres = (ps) => ps.map(p => p.nombre).join(', ');

// Título de un evento de Google: solo los del calendario de agendamiento lo traen; el resto es «Ocupado»
// con el nombre del calendario de donde sale.
const tituloEv = (e) => (e.titulo || 'Ocupado' + (e.calendario ? ' · ' + e.calendario : '')).replace(/\|/g, '/');
// El nombre del lead de una agenda.
const nombreLead = (r) => ((r.lead && r.lead.nombre) || 'Agenda').replace(/\|/g, '/');

// Una tarjeta del calendario, al estilo de Google Calendar: el ícono de su tipo (VISUAL), el título y, si
// entra, la hora (y `sub`). `col` de `ncols`: su lugar cuando se pisa con otras, lado a lado; `capa`: cuánto
// se corre cuando va encimada como carta (agrupadas). `puntos`: el color del closer.
const CORRE_PX = 14;
function Tarjeta({ tipo, clase, top, alto, titulo, hora, sub, tip, col = 0, ncols = 1, capa = null, puntos = null }) {
    const pos = capa != null ? { left: 'calc(min(' + capa * CORRE_PX + 'px, 55%) + 2px)', right: 3 }
        : ncols > 1 ? { left: 'calc(' + (col / ncols * 100) + '% + 2px)', width: 'calc(' + (100 / ncols) + '% - 3px)', right: 'auto' } : null;
    const icono = VISUAL[tipo] && VISUAL[tipo].icono;
    return (
        <div className={'av-card ' + clase} style={{ top, height: alto, ...pos }} data-tip={tip}>
            {alto >= 15 && (
                <span className="av-card-cab">
                    {icono && <Icono n={icono} s={12} className="av-card-ico" />}
                    {puntos}
                    <b className="av-card-tit">{titulo}</b>
                </span>
            )}
            {alto >= 32 && hora && <span className="av-card-hora">{hora}{sub ? ' · ' + sub : ''}</span>}
        </div>
    );
}

// La clase de una pieza o de un grupo de piezas.
const claseDe = (tipo, pzs) => tipo + (pzs.some(z => z.aviso) ? ' ag--aviso' : '') + (tipo === 'cancelada' && pzs.some(z => z.duda) ? ' cx--duda' : '')
    + (pzs.every(z => z.pas) ? ' pas' : '');
// Quita el separador del tooltip de un texto.
const sinBarra = (t) => String(t).replace(/\|/g, '/');

// Los tipos de tarjeta que se pueden ocultar.
const TIPOS = [
    { v: 'ag', n: 'Agendas', cls: 'av-l-ag' },
    { v: 'mg', n: 'Margen', cls: 'av-l-mg' },
    { v: 'ev', n: 'Ocupado', cls: 'av-l-ev', tip: 'Eventos de su Google Calendar' },
    { v: 'tl', n: 'Libres', cls: 'av-l-tu', tip: 'Los turnos libres del evento elegido y el tiempo libre donde no entra una sesión' },
    { v: 'cx', n: 'Canceladas', cls: 'av-l-cx', tip: 'Agendas canceladas o que ya no están en su Google Calendar: no ocupan' },
];

// Una agenda que ya no ocupa: el título y el detalle de por qué (con su evento vinculado, qué le pasó).
function textoCancelada(r, tz) {
    const lead = nombreLead(r), t = r.calendar || {};
    if (r.motivo !== 'sin_evento') {
        return { titulo: 'Cancelada · ' + lead, por: r.resultado ? 'Marcada como ' + r.resultado + '.' : 'Se canceló o reprogramó.' };
    }
    const enNeurops = ' En NeurOPS sigue como ' + (r.resultado || 'agendada') + '.';
    if (t.estado === 'cancelado') return { titulo: 'Cancelada en Calendar · ' + lead, por: 'Su evento se canceló en Google Calendar.' + enNeurops };
    if (t.estado === 'borrado') return { titulo: 'Borrada de Calendar · ' + lead, por: 'Su evento ya no existe en Google Calendar.' + enNeurops };
    if (t.estado === 'disponible') return { titulo: 'Marcada «Disponible» · ' + lead, por: 'Su evento está marcado «Disponible» en Google Calendar: no ocupa.' + enNeurops };
    if (t.estado === 'movido') {
        const nueva = fechaCorta(new Date(t.inicio_nuevo).toISOString().slice(0, 10)) + ' ' + horaTxt(t.inicio_nuevo, tz);
        return { titulo: 'Movida al ' + nueva + ' · ' + lead, por: 'Su evento se movió en Google Calendar al ' + nueva + '.' + enNeurops };
    }
    return { titulo: '¿Cancelada? · ' + lead, por: 'No hay evento suyo en Google Calendar a esa hora, así que el horario queda libre.' + enNeurops };
}

// La traza de una agenda que ocupa, para el detalle: si su evento está vinculado y cómo.
const VINCULO = { propio: 'lo creó NeurOPS', email: 'por el email del lead', nombre: 'por el nombre del lead' };
function textoTraza(t) {
    if (!t) return '';
    if (t.estado === 'rechazado') return ' · El lead rechazó la invitación en Calendar';
    if (t.estado === 'sin_vincular') return ' · Sin evento vinculado en Calendar';
    if (t.estado === 'sin_dato') return ' · No se pudo leer su evento';
    return ' · En Calendar (' + (VINCULO[t.vinculo] || 'vinculada') + ')';
}

// Cuántas agendas de la semana ya no ocupan y, al pasar el mouse, cuáles.
function AvisoCanceladas({ bloques, tz }) {
    const cxs = bloques.flatMap(x => x.items.filter(it => it.tipo === 'cx').map(it => ({ ...it, p: x.p })));
    const dudas = cxs.filter(it => it.reserva.motivo === 'sin_evento').length;
    const lista = cxs.map(it => fechaCorta(new Date(it.a).toISOString().slice(0, 10)) + ' ' + horaTxt(it.a, tz) + ' ' + it.p.nombre + ': ' + textoCancelada(it.reserva, tz).titulo).join(' · ');
    return (
        <span className={'av-ley-s' + (dudas ? ' av-ley-aviso' : '')} data-tip={'Agendas que no ocupan|' + lista.replace(/\|/g, '/')}>
            <Icono n={dudas ? 'alerta' : 'x'} s={12} />
            {cxs.length - dudas > 0 && (cxs.length - dudas) + (cxs.length - dudas === 1 ? ' cancelada' : ' canceladas')}
            {cxs.length - dudas > 0 && dudas > 0 && ' · '}
            {dudas > 0 && dudas + (dudas === 1 ? ' ya no está' : ' ya no están') + ' en Google'}
        </span>
    );
}

// Las agendas cuyo lead rechazó la invitación en Calendar (siguen ocupando: el evento sigue ahí).
function AvisoRechazos({ bloques, tz }) {
    const xs = bloques.flatMap(x => x.items.filter(it => it.tipo === 'ag' && it.reserva.calendar && it.reserva.calendar.estado === 'rechazado').map(it => ({ ...it, p: x.p })));
    if (!xs.length) return null;
    const lista = xs.map(it => fechaCorta(new Date(it.a).toISOString().slice(0, 10)) + ' ' + horaTxt(it.a, tz) + ' ' + it.p.nombre + ': ' + nombreLead(it.reserva)).join(' · ');
    return (
        <span className="av-ley-s av-ley-aviso" data-tip={'El lead rechazó la invitación|' + lista + ' · El horario sigue ocupado mientras el evento siga en su Calendar.'}>
            <Icono n="alerta" s={12} />{xs.length} {xs.length === 1 ? 'rechazada' : 'rechazadas'} por el lead
        </span>
    );
}

export default function Available({ solo = null }) {
    const { d, perfil, reservas } = useDatos();
    const { sim, team } = useUi();
    const ahora = useAhora();
    const edit = !!solo && puedeHorarioDe(d, sim, perfil, solo);
    const semana = team.semana || 0;
    const todos = useMemo(() => closers(d).filter(p => horasSemana(p) > 0), [d]);
    // Filtros: closers y tipos de tarjeta ocultos ({'p:<id>': true, ag|mg|ev|tl: true}).
    const [oculto, setOculto] = useState({});
    const [agrupar_, setAgrupar] = useState(true);
    const alternar = (k) => setOculto(o => ({ ...o, [k]: !o[k] }));
    const ver = (k) => !oculto[k];
    const cs = useMemo(() => (solo ? (horasSemana(solo) > 0 || edit ? [solo] : []) : todos.filter(p => !oculto['p:' + p.id])), [solo, edit, todos, oculto]);

    // Los turnos libres dependen de cuánto dura cada sesión: se elige el evento (agrupados los que dan
    // las mismas sesiones a quienes se ven).
    const grupos = useMemo(() => gruposDeSesion(d, solo ? [solo] : todos), [d, solo, todos]);
    const grupo = grupos.find(x => x.eventos.some(e => e.id === team.evento)) || grupos[0] || null;
    const evento = grupo ? grupo.evento : null;

    // El equipo se ve en la hora de quien mira; la semana de un closer, en la suya (ahí se edita su horario).
    const zonaVista = useZonaVista(), tzVista = solo ? null : zonaVista;
    const { desde, hasta } = rangoSemana(cs, semana, ahora, tzVista);
    const google = useOcupacionGoogle(desde, hasta, cs.length > 0);
    // Las agendas de Agendas 2.0 y las de n8n; las canceladas, aparte.
    const vista = useMemo(() => agendasDeVista(reservas, google), [reservas, google]);

    const cob = useMemo(() => (cs.length ? calcularCobertura({
        todos, cs, semana, ahora, edit, reservasDe: vista.ocupan, canceladasDe: vista.canceladas,
        googleDe: googleDeOcupacion(google), tz: tzVista,
    }) : null), [todos, cs, semana, ahora, edit, vista, google, tzVista]);
    const turnos = useMemo(() => (evento && cs.length ? turnosSemana({
        personas: cs, evento, semana, ahora, reservasDe: vista.ocupan, googleDe: googleDeOcupacion(google), tz: tzVista,
    }) : null), [evento, cs, semana, ahora, vista, google, tzVista]);
    const filaDe = (id) => (turnos ? turnos.filas.find(f => f.p.id === id) : null);

    const [arr, setArr] = useState(null);   // franja que se está arrastrando: {dow, ri, a, b, modo}
    const drag = useRef(null);

    if (!cob) {
        if (!solo && todos.length) {
            return (
                <div className="panel vacio">
                    <p className="t-sm mut">Ocultaste a todos los closers.</p>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setOculto({})}>Mostrar todos</button>
                </div>
            );
        }
        return <div className="panel vacio"><p className="t-sm mut">{solo ? 'Cargá tu horario para ver tu semana.' : 'Cargá horarios en People para ver la cobertura.'}</p></div>;
    }
    const { tz, dias, bloques, huecos, porDia, minH, maxH, hoyK, mAhora, kpi, sinLeer, sinGoogle } = cob;
    const conApi = !!almacen.adaptador.ocupacion, leyendo = conApi && google == null;
    const n = cs.length, alto = (maxH - minH) * HPX;
    // Con varios closers, agrupadas: cada día es una columna angosta. Sin agrupar, lo bastante ancho para
    // leer los carriles de todos (si no entra, se desplaza).
    const agrupado = !solo && n > 1 && agrupar_;
    const anchoMin = 56 + 7 * (agrupado ? 160 : Math.max(120, n * 112));
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

    // Las piezas de un bloque (un closer en una franja), según los filtros: cada una con su tipo visual
    // (VISUAL), sus instantes (a, b) y minutos del día (m0, m1), lo que dice (etiqueta) y su detalle.
    const piezasDe = (x) => {
        const out = [], f = filaDe(x.p.id);
        const pieza = (tipo, a, b, extra) => out.push({
            tipo, a, b, m0: x.m0 + (a - x.t0) / 60000, m1: x.m0 + (b - x.t0) / 60000, p: x.p, pas: b <= ahora, ...extra,
        });
        x.items.forEach(it => {
            if (!ver(it.tipo)) return;
            const lugar = { col: it.col, ncols: it.ncols };
            if (it.tipo === 'ag') {
                const lead = nombreLead(it.reserva), t = it.reserva.calendar;
                pieza('llamada', it.a, it.b, { ...lugar, aviso: !!t && t.estado === 'rechazado', etiqueta: lead, detalle: 'Llamada con ' + lead + textoTraza(t) });
            } else if (it.tipo === 'mg') {
                pieza('margen', it.a, it.b, { ...lugar, etiqueta: 'Margen', detalle: 'margen después de la llamada' });
            } else if (it.tipo === 'ev') {
                const e = it.evento, tit = tituloEv(e);
                pieza(e.titulo ? 'llamada' : 'ocupado', it.a, it.b, { ...lugar, etiqueta: tit, detalle: (e.titulo ? 'En su calendario de agendamiento: ' : '') + tit });
            } else if (it.tipo === 'cx') {
                const c = textoCancelada(it.reserva, tz);
                pieza('cancelada', it.a, it.b, { duda: it.reserva.motivo === 'sin_evento', etiqueta: c.titulo, detalle: c.titulo + '. ' + c.por });
            }
        });
        if (ver('tl')) {
            (f ? f.inicios : []).filter(t => t >= x.t0 && t < x.t1).forEach(t => pieza('libre', t, t + f.dur * 60000, {
                etiqueta: 'Libre', detalle: 'turno libre de ' + f.dur + ' min' + (f.margen ? ' (+' + f.margen + ' de margen)' : ''),
            }));
            huecosLibres(x, { ahora, turnos: f ? f.inicios : [], largoTurno: f ? (f.dur + f.margen) * 60000 : 0 }).forEach(([a, b]) => pieza('hueco', a, b, {
                etiqueta: 'Libre · ' + durTxt((b - a) / 60000), detalle: 'tiempo libre' + (f ? ', no entra una sesión de ' + f.dur + ' min' : ''),
            }));
        }
        return out;
    };
    // Una pieza encimada como carta (agrupadas): el primer nombre del closer con su color y, al pasar el
    // mouse, el detalle.
    const tarjetaCarta = (z, k) => {
        const hora = horaTxt(z.a, tz) + ' – ' + horaTxt(z.b, tz);
        return (
            <Tarjeta key={z.p.id + z.tipo + z.a + '-' + k} tipo={z.tipo} clase={claseDe(z.tipo, [z])} top={y(z.m0)} alto={(z.m1 - z.m0) / 60 * HPX}
                capa={z.capa} titulo={primerNombre(z.p.nombre)} hora={hora} puntos={<i className="av-dot" style={{ '--c': colorVar(z.p.color) }} />}
                tip={sinBarra(VISUAL[z.tipo].n + ' · ' + z.p.nombre) + '|' + sinBarra(hora + ' · ' + z.detalle)} />
        );
    };

    const irSemana = (v) => setTeam({ semana: v === 0 ? 0 : semana + v });
    const ocupPct = Math.round(kpi.ocupacion * 100);
    const nadieLeido = sinLeer.length > 0 && sinLeer.length === cs.length;

    return (
        <>
            <div className="av-kpis">
                {turnos && <div className="av-kpi av-kpi--turnos"><span>Turnos libres</span><b className="num">{turnos.nLibres}<em>/{turnos.nTotal}</em></b></div>}
                <div className="av-kpi"><span>{solo ? 'Tus horas' : 'Horas disponibles'}</span><b className="num">{fmt(kpi.hDisp, 0)}</b></div>
                <div className="av-kpi"><span>Agendado</span><b className="num">{fmt(kpi.hAg, 1)} h<em> · {kpi.nAg} {kpi.nAg === 1 ? 'agenda' : 'agendas'}</em></b></div>
                <div className="av-kpi"><span>Por eventos</span><b className="num">{conApi && !leyendo && !nadieLeido ? fmt(kpi.hEv, 1) + ' h' : '—'}</b></div>
                <div className="av-kpi" data-tip={'Ocupación|Tiempo efectivo de agendas y eventos dentro del horario: lo que se pisa cuenta una vez.' + (sinLeer.length ? ' Sin contar a ' + nombres(sinLeer) + '.' : '')}>
                    <span>Ocupación</span><b className="num">{nadieLeido ? '—' : ocupPct + '%'}<em> · {fmt(kpi.hLibre, 1)} h libres</em></b>
                    <i className="av-barra"><i style={{ width: kpi.ocupAg * 100 + '%' }} /><i className="ev" style={{ width: kpi.ocupEv * 100 + '%' }} /></i>
                </div>
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
                    {grupo && (
                        <div className="av-evento">
                            <span className="t-rotulo">Turnos de</span>
                            <Sx sm id={solo ? 'av-evento-' + solo.id : 'tu-evento'} label="Turnos de" valor={grupo.id} onChange={v => setTeam({ evento: v })}
                                opciones={grupos.map(x => ({ v: x.id, n: x.nombre + ' — ' + x.detalle, icono: 'calendar' }))} />
                        </div>
                    )}
                </div>
                <div className="av-filtros" role="group" aria-label="Filtros">
                    {!solo && todos.map(p => {
                        const f = filaDe(p.id), on = ver('p:' + p.id);
                        return (
                            <button key={p.id} type="button" className="av-fil" aria-pressed={on} style={{ '--c': colorVar(p.color) }} onClick={() => alternar('p:' + p.id)}>
                                <i />{p.nombre}{f && on && <b className="av-ley-n">{f.nLibres} libres</b>}
                            </button>
                        );
                    })}
                    {!solo && <span className="av-fil-sep" />}
                    {!solo && n > 1 && (
                        <button type="button" className="av-fil av-fil--tipo" aria-pressed={agrupar_} onClick={() => setAgrupar(v => !v)}
                            data-tip="Agrupar|Todos los closers en una columna por día, con lo que se pisa encimado como cartas: lo libre adelante, lo ocupado atrás. Sin agrupar, cada closer tiene su carril.">
                            <Icono n="capas" s={13} />Agrupar
                        </button>
                    )}
                    {TIPOS.filter(t => (t.v !== 'ev' || conApi) && (t.v !== 'mg' || bloques.some(x => x.mMg > 0)) && (t.v !== 'cx' || kpi.nCx > 0)).map(t => (
                        <button key={t.v} type="button" className="av-fil av-fil--tipo" aria-pressed={ver(t.v)} data-tip={t.tip} onClick={() => alternar(t.v)}>
                            <i className={t.cls} />{t.n}
                        </button>
                    ))}
                </div>
                <div className="av-ley">
                    {solo && turnos && <span className="av-ley-s"><b className="av-ley-n">{turnos.nLibres} turnos libres</b> de {turnos.nTotal} esta semana</span>}
                    {edit && <span className="av-ley-s av-ley-edit"><Icono n="edit" s={12} />Arrastrá para crear o mover · se repite cada semana</span>}
                    <span className="av-ley-s"><i className="av-l-hu" />Sin closer</span>
                    {kpi.nCx > 0 && <AvisoCanceladas bloques={bloques} tz={tz} />}
                    <AvisoRechazos bloques={bloques} tz={tz} />
                    {leyendo && <span className="av-ley-s">Leyendo calendarios…</span>}
                    {sinLeer.length > 0 && <span className="av-ley-s av-ley-aviso"><Icono n="alerta" s={12} />No se pudo leer el calendario de {nombres(sinLeer)}</span>}
                    {sinGoogle.length > 0 && <span className="av-ley-s"><Icono n="calendar" s={12} />Sin Google Calendar: {nombres(sinGoogle)} (solo agendas)</span>}
                </div>
                <div className="av-cal">
                    <div className="av-cab" style={{ minWidth: anchoMin }}>
                        <span className="av-tz">{gmtTxt(tz, ahora)}</span>
                        {dias.map((dd, di) => {
                            const pd = porDia[di], esHoy = dd.k === hoyK;
                            return (
                                <div key={dd.k} className={'av-dia' + (esHoy ? ' av-dia--hoy' : '')}>
                                    <span>{DIAS[(dd.d.getUTCDay() + 6) % 7].n.slice(0, 3)}</span><b>{dd.d.getUTCDate()}</b>
                                    <em>{turnos ? turnos.filas.reduce((s, f) => s + f.libres[di], 0) + ' libres' : pd.t ? Math.round(pd.a / pd.t * 100) + '%' : '—'}</em>
                                </div>
                            );
                        })}
                    </div>
                    <div className="av-cuerpo" style={{ height: alto, minWidth: anchoMin }}>
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
                                        {agrupado && apilar(bls.flatMap(piezasDe)).map(tarjetaCarta)}
                                        {!agrupado && bls.map((x, i) => {
                                            const vivo = enArr && arr.modo !== 'crear' && arr.ri === x.ri;
                                            const m0 = vivo ? arr.a : x.m0, m1 = vivo ? arr.b : x.m1;
                                            const txtH = vivo ? hmTxt(m0) + '–' + hmTxt(m1) : horaTxt(x.t0, tz) + '–' + horaTxt(x.t1, tz);
                                            return (
                                                <div key={x.p.id + '-' + x.dow + '-' + x.ri} data-i={i} className={'av-bloque' + (vivo ? ' av-bloque--drag' : '') + (x.sinLeer ? ' av-bloque--sinleer' : '')}
                                                    style={{ '--c': colorVar(x.p.color), top: y(m0), height: (m1 - m0) / 60 * HPX, left: 'calc(' + (x.li / n * 100) + '% + 2px)', width: 'calc(' + (100 / n) + '% - 4px)' }}
                                                    data-tip={x.p.nombre + ' · ' + horaTxt(x.t0, tz) + '–' + horaTxt(x.t1, tz) + '|' + resumenBloque(x)}>
                                                    {edit ? (
                                                        <>
                                                            <span className="av-asa av-asa--t" data-av="t" />
                                                            <span className="av-asa av-asa--b" data-av="b" />
                                                            <button type="button" className="av-del" aria-label={'Quitar ' + txtH} onClick={() => quitar(x)}><Icono n="x" s={11} /></button>
                                                            <span className="av-hora">{txtH}</span>
                                                        </>
                                                    ) : null}
                                                    {!vivo && piezasDe(x).map((z, k) => {
                                                        const hora = horaTxt(z.a, tz) + ' – ' + horaTxt(z.b, tz);
                                                        return (
                                                            <Tarjeta key={z.tipo + z.a + '-' + k} tipo={z.tipo} clase={claseDe(z.tipo, [z])}
                                                                top={(z.a - x.t0) / 3600000 * HPX} alto={(z.b - z.a) / 3600000 * HPX} col={z.col} ncols={z.ncols}
                                                                titulo={n > 1 ? primerNombre(x.p.nombre) : z.etiqueta} hora={hora}
                                                                tip={sinBarra(VISUAL[z.tipo].n + ' · ' + x.p.nombre) + '|' + sinBarra(hora + ' · ' + z.detalle)} />
                                                        );
                                                    })}
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
