// Flujo del evento: lienzo navegable con los pasos del lead, mapa de calor con datos de ejemplo e inspector por paso.

import { useMemo } from 'react';
import { ESTRATEGIAS, conOpciones } from '../../core/catalogos';
import { buscar, nombreGrupo, ord } from '../../core/datos';
import { linkEvento, slugLibre } from '../../core/eventos';
import { almacen, useDatos } from '../../data/hooks';
import { Icono, Sx } from '../../ui/base';
import Lienzo from '../../ui/Lienzo';
import { ui } from '../../ui/estadoUi';
import { reachEvento, useLeads } from '../stats/leads';
import { armarFlujo, caminoArista } from './armarFlujo';
import { textoEstrategia } from './comun';

const LEYENDA = [['var(--info)', 'Preguntas'], ['var(--brand-secondary)', 'Función'], ['var(--warning)', 'Estrategia'], ['var(--success)', 'Agenda'], ['var(--error)', 'No califica']];

function setEv(parcial) { const ev = ui.getState().ev; if (ev) ui.set({ ev: { ...ev, ...parcial } }); }

function irForm(id, vista, sel) {
    almacen.flush();
    ui.set({ seccion: 'preguntas', form: sel ? { id, vista, sel } : { id, vista } });
    window.scrollTo({ top: 0 });
}
function irTeam() {
    almacen.flush();
    ui.set({ seccion: 'team', team: { ...ui.getState().team, tab: 'grupos' } });
    window.scrollTo({ top: 0 });
}

function Nodo({ n, sel, cuello, calor, max }) {
    const pct = n.calor != null ? Math.round(n.calor / max * 100) : 0;
    return (
        <button type="button" className={'nodo' + (sel ? ' nodo--sel' : '') + (cuello && calor ? ' nodo--cuello' : '')} data-nav=""
            aria-pressed={sel} aria-label={n.tipo + ': ' + n.tit} style={{ left: n.x, top: n.y, '--c': n.c }}
            onClick={() => setEv({ nodo: sel ? null : n.id })}>
            {cuello && calor && <span className="chip cuello-chip" style={{ '--c': 'var(--error)' }}><Icono n="fuego" />Cuello de botella</span>}
            <span className="nodo-cab"><Icono n={n.ico} />{n.tipo}{n.var_ ? <em>{n.var_}</em> : null}</span>
            <span className="nodo-tit">{n.tit}</span>
            {n.filas.map((r, i) => (
                <span key={i} className={'nodo-fila' + (r.no ? ' nodo-fila--no' : '')}>
                    <span>{r.t}</span>
                    {r.no ? <em><Icono n="prohibido" s={12} /></em> : r.pts != null ? <em>{r.pts}</em> : null}
                </span>
            ))}
            {calor && n.calor != null && (
                <span className="nodo-calor" style={{ '--c': cuello ? 'var(--error)' : 'var(--brand-secondary)' }}>
                    <span><b>{pct}%</b>{n.calor} leads</span>
                    <span className="barra-c"><i style={{ width: pct + '%' }} /></span>
                </span>
            )}
        </button>
    );
}

function Inspector({ d, e, n }) {
    const fo = buscar(d, 'formularios', e.formulario);
    const cab = (t) => (
        <div className="barra">
            <span className="t-rotulo">{t}</span>
            <button type="button" className="ibtn ibtn--xs" data-nav="" aria-label="Cerrar" style={{ marginLeft: 'auto' }} onClick={() => setEv({ nodo: null })}><Icono n="x" /></button>
        </div>
    );
    let cuerpo;
    if (n === 'inicio') {
        cuerpo = (
            <>
                {cab('Inicio')}
                <span className="t-cap mut" id="in-funnel-l">Funnel</span>
                <Sx id="in-funnel" label="Funnel" valor={e.funnel}
                    onChange={v => almacen.editar('eventos', e.id, { funnel: v, slug: slugLibre(d, { ...e, funnel: v }, e.slug) }, true)}
                    opciones={(e.funnel ? [] : [{ v: '', n: 'Elegí funnel' }]).concat(ord(d, 'funnels').map(x => ({ v: x.id, n: x.nombre })))} />
                <p className="t-cap mut40">{linkEvento(d, e)}</p>
            </>
        );
    } else if (n === 'calif') {
        cuerpo = (
            <>
                {cab('Segmentación')}
                {fo ? (
                    <>
                        {fo.reglas.map((r, i) => (
                            <div key={r.id} style={{ display: 'grid', gap: 4 }}>
                                <b className="t-sm">Regla {i + 1} → {nombreGrupo(d, r.grupo)}</b>
                                {r.cond.map((c, j) => {
                                    const q = fo.preguntas.find(x => x.id === c.q);
                                    return <span key={j} className="t-cap mut">{q ? q.titulo : '—'}: {q ? q.opciones.filter(o => c.ops.includes(o.id)).map(o => o.texto).join(' o ') : ''}</span>;
                                })}
                            </div>
                        ))}
                        <b className="t-sm">Todo lo demás → {nombreGrupo(d, fo.resto)}</b>
                        <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => irForm(fo.id, 'ruteo')}><Icono n="edit" />Editar en Forms</button>
                    </>
                ) : <p className="t-sm mut">Elegí un formulario.</p>}
            </>
        );
    } else if (n.startsWith('g-')) {
        const g = buscar(d, 'grupos', n.slice(2));
        cuerpo = !g ? <>{cab('Estrategia')}<p className="t-sm mut">Elegí una estrategia en la segmentación.</p></> : (
            <>
                {cab(g.nombre)}
                <div style={{ display: 'grid', gap: 10 }}>
                    <Sx id={'ige-' + g.id} label="Estrategia" valor={g.estrategia} onChange={v => almacen.editar('grupos', g.id, { estrategia: v }, true)}
                        opciones={Object.keys(ESTRATEGIAS).map(k => ({ v: k, n: ESTRATEGIAS[k] }))} />
                    <p className="t-cap mut">{textoEstrategia(d, g)}</p>
                    <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={irTeam}><Icono n="users" />Abrir en Team</button>
                </div>
            </>
        );
    } else if (n.startsWith('q-') && fo) {
        const q = fo.preguntas.find(x => 'q-' + x.id === n);
        if (!q) return null;
        cuerpo = (
            <>
                {cab('Pregunta')}
                <p className="t-sm" style={{ fontWeight: 700 }}>{q.titulo}</p>
                {conOpciones(q.tipo) && q.opciones.map(o => (
                    <div key={o.id} className="barra">
                        <span className="t-cap" style={{ flex: 1 }}>{o.texto}</span>
                        {o.descalifica
                            ? <span className="chip" style={{ '--c': 'var(--error)' }} title="No califica"><Icono n="prohibido" /></span>
                            : <span className="chip chip--n" style={{ '--c': 'var(--idle)' }}>{o.puntos == null ? '–' : o.puntos} pts</span>}
                    </div>
                ))}
                <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => irForm(fo.id, 'preguntas', q.id)}><Icono n="edit" />Editar en Forms</button>
            </>
        );
    } else if (n === 'contacto' && fo) {
        cuerpo = <>{cab('Contacto')}<button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => irForm(fo.id, 'preguntas')}><Icono n="edit" />Editar formulario</button></>;
    } else {
        cuerpo = <>{cab('Paso')}<p className="t-sm mut">Sin ajustes para este paso.</p></>;
    }
    return <aside className="inspector" aria-label="Detalle del paso">{cuerpo}</aside>;
}

export default function Flujo({ e, ev }) {
    const { d } = useDatos();
    const calor = ev.calor !== false;
    const { leads, ejemplo } = useLeads();
    const reach = useMemo(() => (leads ? reachEvento(d, e, leads) : null), [d, e, leads]);
    const { nodos, aristas, W, H, cuello, max } = useMemo(() => armarFlujo(d, e, reach, calor), [d, e, reach, calor]);
    return (
        <>
            <div className="barra" style={{ marginBottom: 12 }}>
                <div className="leyenda">{LEYENDA.map(([c, t]) => <span key={t} style={{ '--c': c }}><i />{t}</span>)}</div>
                <div className="barra-der">
                    {reach && (ejemplo
                        ? <span className="aviso-ej"><Icono n="alerta" />Ejemplo · 30 días</span>
                        : <span className="t-sm mut">Últimos 30 días</span>)}
                    <span className="sw">
                        <Icono n="fuego" />Mapa de calor
                        <button type="button" className="switch" role="switch" data-nav="" aria-checked={calor} aria-label="Mapa de calor" onClick={() => setEv({ calor: !calor })} />
                    </span>
                </div>
            </div>
            <div className="flujo">
                <Lienzo ancho={W} alto="min(72vh, 760px)" etiqueta="Flujo del evento" encima={ev.nodo ? <Inspector d={d} e={e} n={ev.nodo} /> : null}>
                    <div className="flujo-lienzo" style={{ width: W, height: H }}>
                        <svg className="aristas" width={W} height={H} aria-hidden="true">
                            {aristas.map((a, i) => {
                                const k = caminoArista(a);
                                return (
                                    <g key={i}>
                                        <path d={k.d} fill="none" stroke={k.c} strokeWidth="1.5" />
                                        <circle cx={k.x1} cy={k.y1} r="4" fill={k.c} />
                                        <circle cx={k.x2} cy={k.y2} r="4.5" fill="var(--nodo)" stroke={k.c} strokeWidth="1.5" />
                                    </g>
                                );
                            })}
                        </svg>
                        {nodos.map(n => <Nodo key={n.id} n={n} sel={ev.nodo === n.id} cuello={cuello === n.id} calor={calor} max={max} />)}
                    </div>
                </Lienzo>
            </div>
        </>
    );
}
