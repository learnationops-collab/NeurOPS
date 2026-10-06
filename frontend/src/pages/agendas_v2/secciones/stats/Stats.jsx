// Stats: agendas, calificación, rankings, embudo y horarios más elegidos. Por ahora con datos de
// ejemplo (deterministas) hasta que el backend registre leads reales.
// En vista de closer se ve solo lo propio: sin "No califican" ni los rankings del equipo.

import { useMemo } from 'react';
import { Avatar, Humo, HUMO_MARCA, Icono, Seg, Sx } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import EnTope from '../../ui/EnTope';
import { useDatos, usePermisos, useUi } from '../../data/hooks';
import { COLORES } from '../../core/catalogos';
import { buscar, closers, colorVar, ord, setters } from '../../core/datos';
import { fmt } from '../../core/util';
import { irA } from '../../ui/navegacion';
import { datosEjemplo } from './datosEjemplo';
import { Embudo, Gauges, Grafico, Linea, MapaHorarios, Ranking, VacioGrafico } from './graficos';

const DIA = 86400000;
const EST_DEF = { dias: 30, evento: '', closer: '' };

// Color de cada prioridad según su posición (1 = la más alta).
function colorNivel(n) { return ['var(--brand-secondary)', 'var(--warning)', 'var(--info)', 'var(--success)', 'var(--idle)'][Math.max(0, Math.min(4, n - 1))]; }

function contar(ls, fn) {
    const m = {};
    ls.forEach(l => { const k = fn(l); if (k == null) return; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(k => [k, m[k]]).sort((x, y) => y[1] - x[1]);
}
function kp(ls) {
    const ag = ls.filter(l => l.agenda), sc = ag.filter(l => l.score != null);
    return {
        agendas: ag.length, calif: ag.filter(l => l.score != null && l.score >= 7).length, desc: ls.filter(l => l.desc).length,
        prom: sc.length ? sc.reduce((s, l) => s + l.score, 0) / sc.length : null, leads: ls.length,
    };
}

function Delta({ x, y, inv, dec = 0, dias }) {
    if (x == null || y == null) return <small>sin dato previo</small>;
    const df = x - y, pc = y ? df / y * 100 : 0, bueno = inv ? df <= 0 : df >= 0;
    return (
        <>
            <span className="delta" style={{ '--c': df === 0 ? 'var(--idle)' : bueno ? 'var(--success)' : 'var(--error)' }}>
                <Icono n={df >= 0 ? 'sube' : 'baja'} />{(df >= 0 ? '+' : '') + fmt(df, dec)}{y ? ' (' + (pc >= 0 ? '+' : '') + fmt(pc, 1) + '%)' : ''}
            </span>
            <small>vs {dias} días antes</small>
        </>
    );
}

const irAFunnels = () => ui.set({ funnel: {} });

export default function Stats() {
    const { d } = useDatos();
    const estado = useUi();
    const { modoCloser: cm } = usePermisos();
    const st = { ...EST_DEF, ...(estado.est || {}) };
    const setEst = (parcial) => ui.set(e => ({ est: { ...EST_DEF, ...(e.est || {}), ...parcial } }));

    const calc = useMemo(() => {
        const datos = datosEjemplo(d);
        if (!datos) return null;
        // Los datos de ejemplo se miden contra el momento actual.
        // eslint-disable-next-line react-hooks/purity
        const ahora = Date.now(), dur = st.dias * DIA;
        const filtro = (l) => (!st.evento || l.ev === st.evento) && (cm ? l.closer === cm.id : !st.closer || l.closer === st.closer);
        const act = datos.leads.filter(l => l.t >= ahora - dur && filtro(l));
        const ant = datos.leads.filter(l => l.t < ahora - dur && l.t >= ahora - 2 * dur && filtro(l));
        const serie = [], serieAnt = [];
        for (let i = st.dias - 1; i >= 0; i--) {
            const ini = ahora - (i + 1) * DIA, fin = ahora - i * DIA;
            serie.push(act.filter(l => l.agenda && l.t >= ini && l.t < fin).length);
            serieAnt.push(ant.filter(l => l.agenda && l.t >= ini - dur && l.t < fin - dur).length);
        }
        return { ahora, act, ant, a: kp(act), b: kp(ant), serie, serieAnt, ag: act.filter(l => l.agenda) };
    }, [d, st.dias, st.evento, st.closer, cm]);

    if (!calc) {
        return (
            <div className="panel vacio">
                <Humo clase="humo--hero" cols={HUMO_MARCA} />
                <span className="icono-m"><Icono n="chart" s={19} /></span>
                <h2 className="t-h3">Sin eventos todavía</h2>
                <p className="t-sm mut">Creá un evento para ver estadísticas.</p>
                <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => irA('eventos')}>Ir a Eventos</button>
            </div>
        );
    }

    const { ahora, act, a, b, serie, serieAnt, ag } = calc;
    const dl = (x, y, inv, dec) => <Delta x={x} y={y} inv={inv} dec={dec} dias={st.dias} />;
    const kpis = [
        [cm ? 'Tus agendas' : 'Agendas creadas', a.agendas, dl(a.agendas, b.agendas), ['var(--brand-secondary)', 'var(--brand-primary)']],
        ['Calificadas (≥ 7)', a.calif, dl(a.calif, b.calif), ['var(--success)', 'var(--brand-primary)']],
        cm ? null : ['No califican', a.desc, dl(a.desc, b.desc, true), ['var(--error)', 'var(--brand-navy)']],
        [cm ? 'Calificación de tus leads' : 'Calificación promedio', a.prom == null ? '–' : fmt(a.prom, 1), dl(a.prom, b.prom, false, 1), ['var(--info)', 'var(--brand-primary)']],
    ].filter(Boolean);

    const sumA = serie.reduce((x, y) => x + y, 0), mejor = Math.max(...serie);

    const porEv = contar(ag, l => l.ev).map(x => {
        const e = buscar(d, 'eventos', x[0]), f = e && buscar(d, 'funnels', e.funnel);
        return { k: e ? e.nombre : 'Evento borrado', v: x[1], c: f ? colorVar(f.color) : 'var(--idle)', sub: f ? f.nombre : '' };
    });

    let equipo = null;
    if (!cm) {
        const porCl = contar(ag, l => l.closer || '-').map(x => {
            const p = buscar(d, 'personas', x[0]);
            return { k: p ? p.nombre : 'Sin asignar', v: x[1], c: p ? colorVar(p.color) : 'var(--idle)', av: p ? <Avatar p={p} clase="avatar--xs" /> : null, sub: p ? 'Top ' + p.nivel : '' };
        });
        const porOr = contar(ag, l => l.origen || 'Directo');
        const porSt = contar(ag, l => l.setter || null);
        const sts = setters(d);
        const porG = {}, tot = [0, 0];
        ag.forEach(l => {
            if (l.score == null) return;
            const g = buscar(d, 'grupos', l.grupo), k = g ? g.id : '-';
            porG[k] = porG[k] || [0, 0]; porG[k][0] += l.score; porG[k][1]++; tot[0] += l.score; tot[1]++;
        });
        const gs = ord(d, 'grupos');
        const gauges = Object.keys(porG).map(k => {
            const g = buscar(d, 'grupos', k), gi = gs.indexOf(g);
            return { k: g ? g.nombre : 'Sin estrategia', v: porG[k][0] / porG[k][1], n: porG[k][1], c: g ? colorNivel(gi + 1) : 'var(--idle)', i: gi < 0 ? 99 : gi };
        }).sort((x, y) => x.i - y.i);

        // Embudo del evento elegido (o el que más leads tiene).
        const evId = st.evento || (contar(act, l => l.ev)[0] || [])[0], e = buscar(d, 'eventos', evId);
        let embudo = null;
        if (e) {
            const fo = buscar(d, 'formularios', e.formulario), qs = fo ? fo.preguntas : [], ls = act.filter(l => l.ev === e.id);
            const pasos = [['Entraron al link', 0, 'link'], ['Datos de contacto', 1, 'user']]
                .concat(qs.map((q, j) => [q.titulo || 'Pregunta ' + (j + 1), 2 + j, 'pregunta']))
                .concat([['Calendario', 2 + qs.length, 'calendar'], ['Agendaron', 3 + qs.length, 'check']]);
            const vals = pasos.map(p => ls.filter(l => l.llego >= p[1]).length);
            embudo = (
                <Grafico t={'Embudo · ' + e.nombre} sub="Cuántos leads siguen en cada paso" ancho aura={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--error)', 'var(--brand-navy)']}>
                    <Embudo pasos={pasos} vals={vals} />
                </Grafico>
            );
        }

        equipo = (
            <>
                <Grafico t="Por closer" sub="Quién recibe las agendas" aura={['var(--fc-azul)', 'var(--brand-primary)', 'var(--fc-rosa)', 'var(--brand-navy)']}>
                    <Ranking items={porCl} />
                </Grafico>
                <Grafico t="Por procedencia" sub="Qué link usaron" aura={['var(--fc-turquesa)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']}>
                    {porOr.length < 2
                        ? <VacioGrafico icono="link" txt="Todas entraron por el link general." accion="Creá links por procedencia" onAccion={irAFunnels} />
                        : <Ranking items={porOr.map((x, i) => ({ k: x[0], v: x[1], c: x[0] === 'Directo' ? 'var(--idle)' : colorVar(COLORES[i % COLORES.length]) }))} />}
                </Grafico>
                <Grafico t="Por setter" sub="Quién trajo cada agenda" aura={['var(--fc-violeta)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']}>
                    {!porSt.length
                        ? <VacioGrafico icono="user" txt="Ninguna agenda vino de un setter." accion="Darle un link a cada setter" onAccion={irAFunnels} />
                        : <Ranking items={porSt.map(x => {
                            const p = sts.find(s => s.nombre === x[0]);
                            return { k: x[0], v: x[1], c: p ? colorVar(p.color) : 'var(--fc-violeta)', av: p ? <Avatar p={p} clase="avatar--xs" /> : null };
                        })} />}
                </Grafico>
                <Grafico t="Calificación por estrategia" sub="Promedio de 0 a 10 de los leads que agendaron" ancho aura={['var(--success)', 'var(--brand-primary)', 'var(--fc-turquesa)', 'var(--brand-navy)']}>
                    <Gauges items={gauges} prom={tot[1] ? tot[0] / tot[1] : null} />
                </Grafico>
                {embudo}
            </>
        );
    }

    return (
        <>
            <EnTope>
                <div className="barra">
                    <Seg label="Período" nav valor={st.dias} onChange={v => setEst({ dias: v })} opciones={[7, 30, 90].map(n => ({ v: n, n: n + ' días' }))} />
                    <Sx label="Evento" nav valor={st.evento} onChange={v => setEst({ evento: v })}
                        opciones={[{ v: '', n: 'Todos los eventos' }, ...ord(d, 'eventos').map(e => ({ v: e.id, n: e.nombre }))]} />
                    {!cm && (
                        <Sx label="Closer" nav valor={st.closer} onChange={v => setEst({ closer: v })}
                            opciones={[{ v: '', n: 'Todos los closers' }, ...closers(d).map(p => ({ v: p.id, n: p.nombre }))]} />
                    )}
                    <div className="barra-der"><span className="aviso-ej"><Icono n="alerta" />Datos de ejemplo</span></div>
                </div>
            </EnTope>
            <div className="kpis">
                {kpis.map(k => (
                    <div key={k[0]} className="kpi">
                        <Humo cols={[k[3][0], k[3][1], k[3][0], 'var(--brand-navy)']} />
                        <span className="t-eyebrow">{k[0]}</span>
                        <span className="kpi-n">{k[1]}</span>
                        <div>{k[2]}</div>
                    </div>
                ))}
            </div>
            <div className="graficos">
                <Grafico t="Agendas por día" sub={'Promedio ' + fmt(sumA / st.dias, 1) + ' por día · mejor día ' + mejor} ancho aura={HUMO_MARCA}
                    extra={<span className="leyenda"><span style={{ '--c': 'var(--brand-secondary)' }}><i />Este período</span><span className="ley-pun"><i />Período anterior</span></span>}>
                    <Linea s={serie} s2={serieAnt} ahora={ahora} />
                </Grafico>
                <Grafico t="Por evento" sub="De dónde salen las agendas" aura={['var(--fc-ambar)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']}>
                    <Ranking items={porEv} />
                </Grafico>
                {equipo}
                <Grafico t="Horarios más elegidos" sub="Cuándo prefieren agendar los leads" ancho aura={HUMO_MARCA}
                    extra={<span className="hc-esc"><span>menos</span><i /><span>más</span></span>}>
                    <MapaHorarios agendas={ag} />
                </Grafico>
            </div>
        </>
    );
}
