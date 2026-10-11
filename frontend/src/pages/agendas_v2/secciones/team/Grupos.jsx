// Estrategias: cada una es una lista ordenada de closers y una forma de repartir los leads.
// La segmentación del formulario elige la estrategia; si nadie tiene lugar, pasa a la siguiente.

import { useCallback } from 'react';
import { pesoDe } from '../../core/asignacion';
import { COLOR_EST, ESTRATEGIAS, ICO_EST } from '../../core/catalogos';
import { closers, colorVar, esCloser, horasSemana, maxOrden, ord } from '../../core/datos';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { HUMO_MARCA, Avatar, Humo, Icono } from '../../ui/base';
import { toast } from '../../ui/toast';
import { useOrdenable } from '../../ui/useOrdenable';
import { avisoPrioridad, textoEstrategia } from './cobertura';
import { CampoNombre, Compo, Nivel, colorNivel } from './comun';
import ElegirCloser, { useUsuariosReales } from './ElegirCloser';

const SUGERIDAS = ['Ultra cualificado', 'Medio cualificado', 'General'];

// Lo que le falta a un closer de Team para recibir agendas. Calendar y WhatsApp salen de su cuenta
// de la app (por email); en modo local no se saben y no llevan chip.
function listoDe(p, usuarios) {
    const u = usuarios && usuarios.find(x => x.email && x.email.toLowerCase() === (p.email || '').toLowerCase());
    const sabe = Array.isArray(usuarios) && usuarios.length > 0;
    return {
        id: p.id, nombre: p.nombre, extra: 'Top ' + p.nivel, horarios: horasSemana(p) > 0,
        calendar: sabe ? !!(u && u.calendar) : undefined, whatsapp: sabe ? !!(u && u.whatsapp) : undefined,
    };
}

export function crearGrupo(d, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return 'Escribí un nombre.';
    almacen.crear('grupos', { nombre, estrategia: /medio|general/i.test(nombre) ? 'repartir' : 'llenar', miembros: [], orden: maxOrden(d, 'grupos') + 1 });
    return '';
}

// Al borrar una prioridad, las reglas de los formularios que la usaban quedan sin destino.
function borrarGrupo(g) {
    almacen.getState().d.formularios.forEach(f => {
        const usa = f.reglas.some(r => r.grupo === g.id) || f.resto === g.id;
        if (!usa) return;
        almacen.editar('formularios', f.id, {
            reglas: f.reglas.map(r => (r.grupo === g.id ? { ...r, grupo: '' } : r)),
            resto: f.resto === g.id ? '' : f.resto,
        });
    });
    almacen.flush();
    almacen.borrar('grupos', g.id);
    toast(g.nombre + ' eliminado');
}

// Distribuida: el porcentaje que se ve es el guardado o la parte pareja. Al cambiar uno se guardan
// todos, para que lo que se ve sea lo que reparte.
const pctDe = (g, pid) => Math.round(pesoDe(g, pid, g.miembros.length));
function cambiarPct(g, pid, v) {
    const pesos = Object.fromEntries(g.miembros.map(id => [id, pctDe(g, id)]));
    pesos[pid] = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    almacen.editar('grupos', g.id, { pesos }, true);
}

function Miembro({ p, j, g, numerar, ordenable, pct }) {
    const { d } = useDatos();
    return (
        <div data-item={p.id} className={'pm' + ordenable.claseItem(p.id)} style={{ '--c': colorVar(p.color) }}>
            <button type="button" className="grip pm-grip" {...ordenable.grip(p.id, 'Mover ' + p.nombre)}><Icono n="grip" /></button>
            <span className="pm-av"><Avatar p={p} clase="avatar--sm" />{numerar && <i className="pm-num num">{j + 1}</i>}</span>
            <span className="pm-txt"><b>{p.nombre}</b>{esCloser(d, p) && <Nivel n={p.nivel} />}</span>
            {pct && (
                <label className="pm-pct">
                    <span className="sr">{'Porcentaje de ' + p.nombre}</span>
                    <input className="input num" type="number" min={0} max={100} step={5} value={pctDe(g, p.id)}
                        onChange={ev => cambiarPct(g, p.id, ev.target.value)} />%
                </label>
            )}
            {!horasSemana(p) && (
                <span className="pm-aviso" role="img" aria-label="Sin horario" data-tip="Sin horario|No recibe leads hasta que cargue horario.">
                    <Icono n="alerta" s={13} />
                </span>
            )}
            <button type="button" className="pm-x" aria-label={'Quitar a ' + p.nombre}
                onClick={() => almacen.editar('grupos', g.id, { miembros: g.miembros.filter(x => x !== p.id) }, true)}>
                <Icono n="x" s={13} />
            </button>
        </div>
    );
}

function Prioridad({ g, i, ordenable, usuarios }) {
    const { d } = useDatos();
    const { lectura } = usePermisos();
    const ms = g.miembros.map(id => d.personas.find(p => p.id === id)).filter(Boolean);
    const libres = closers(d).filter(p => !g.miembros.includes(p.id));
    const enOrden = g.estrategia !== 'repartir', pc = colorNivel(i + 1);
    const reordenar = useCallback((ids) => almacen.editar('grupos', g.id, { miembros: ids }, true), [g.id]);
    const { contenedor: omCont, ...om } = useOrdenable(ms.map(p => p.id), reordenar, { horizontal: true });
    const pct = g.estrategia === 'repartir' && ms.length > 1;
    const total = pct ? ms.reduce((s, p) => s + pctDe(g, p.id), 0) : 100;
    const aviso = avisoPrioridad(d, g) || (Math.abs(total - 100) > 1 ? 'Los porcentajes suman ' + total + '%: se reparte en esa proporción.' : '');
    const msOrden = om.lista.map(id => ms.find(p => p.id === id)).filter(Boolean);

    return (
        <article data-item={g.id} className={'tarjeta pr caja' + ordenable.claseItem(g.id)} style={{ '--pc': pc }}>
            <Humo clase={'humo--tarjeta' + (i ? ' humo--suave' : '')} cols={i ? ['var(--brand-primary)', 'var(--brand-navy)', pc, 'var(--brand-navy)'] : HUMO_MARCA} />
            <div className="pr-cab">
                <button type="button" className="grip" {...ordenable.grip(g.id, 'Mover estrategia ' + g.nombre)}><Icono n="grip" /></button>
                <span className="pr-n num" title={'Estrategia ' + (i + 1)}>{i + 1}</span>
                <label className="sr" htmlFor={'gn-' + g.id}>Nombre de la estrategia</label>
                <CampoNombre className="pr-nom" id={'gn-' + g.id} maxLength={60} valor={g.nombre} onGuardar={v => almacen.editar('grupos', g.id, { nombre: v })} />
                <div className="seg seg--sm pr-est" role="radiogroup" aria-label="Cómo reparte">
                    {Object.keys(ESTRATEGIAS).map(k => (
                        <button key={k} type="button" role="radio" aria-checked={g.estrategia === k} aria-pressed={g.estrategia === k} style={{ '--ec': COLOR_EST[k] }}
                            onClick={() => almacen.editar('grupos', g.id, { estrategia: k }, true)}>
                            <Icono n={ICO_EST[k]} s={14} />{ESTRATEGIAS[k]}
                        </button>
                    ))}
                </div>
                <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label={'Eliminar estrategia ' + g.nombre} onClick={() => borrarGrupo(g)}><Icono n="basura" s={15} /></button>
            </div>
            <div className={'pr-flujo lista--h' + (enOrden ? ' pr-flujo--orden' : '')} ref={omCont}>
                {msOrden.map((p, j) => <Miembro key={p.id} p={p} j={j} g={g} numerar={enOrden} ordenable={om} pct={pct} />)}
                {libres.length > 0 && !lectura && (
                    <div className="pm-sumar">
                        <ElegirCloser opciones={libres.map(p => listoDe(p, usuarios))}
                            onElegir={v => almacen.editar('grupos', g.id, { miembros: g.miembros.concat([v]) }, true)} />
                    </div>
                )}
                {!ms.length && <span className="t-cap mut40">Sin closers todavía</span>}
            </div>
            <p className="pr-regla">
                <span className="num">{ms.length}{ms.length === 1 ? ' closer' : ' closers'}</span> · {textoEstrategia(d, g)}
                {aviso && <><br /><span style={{ color: 'var(--warning)' }}>{aviso}</span></>}
            </p>
        </article>
    );
}

export default function Grupos() {
    const { d } = useDatos();
    const { lectura } = usePermisos();
    const usuarios = useUsuariosReales(!lectura);
    const gs = ord(d, 'grupos');
    const usados = gs.map(g => g.nombre.toLowerCase());
    const sug = SUGERIDAS.filter(n => !usados.includes(n.toLowerCase()));
    const reordenar = useCallback((ids) => {
        ids.forEach((id, i) => almacen.editar('grupos', id, { orden: i + 1 }));
        almacen.flush();
    }, []);
    const { contenedor: ordenCont, ...orden } = useOrdenable(gs.map(g => g.id), reordenar);

    const compo = (
        <Compo vacio={!gs.length} tit="Nueva estrategia" soloTit="Creá tus estrategias" ph="Nombre, ej. Ultra cualificado" onCrear={v => crearGrupo(d, v)}
            sug={sug.length > 0 && (
                <div className="compo-sug">
                    <span className="t-rotulo">Rápido</span>
                    {sug.map(n => <button key={n} type="button" className="sug" onClick={() => crearGrupo(d, n)}><Icono n="plus" />{n}</button>)}
                </div>
            )} />
    );
    if (!gs.length) return lectura ? <div className="panel vacio"><p className="t-sm mut">Todavía no hay estrategias.</p></div> : compo;
    return (
        <>
            {!lectura && compo}
            <div className="lista" ref={ordenCont}>
                {orden.lista.map(id => gs.find(g => g.id === id)).filter(Boolean).map((g, i) => (
                    <Prioridad key={g.id} g={g} i={i} ordenable={orden} usuarios={usuarios} />
                ))}
            </div>
        </>
    );
}
