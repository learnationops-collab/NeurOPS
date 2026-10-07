// Flujo del ruteo: respuestas → regla → prioridad → closers, más la rama de "No califica".
// avisos: índices de las reglas que la revisión marca (se pisan, se repiten o están vacías).

import React from 'react';
import { CONTACTO, ESTRATEGIAS, ICO_EST } from '../../core/catalogos';
import { buscar, ord } from '../../core/datos';
import { Avatar, Icono } from '../../ui/base';
import { colorNivel } from './comun';

function opsTxt(q, ops) { return q ? q.opciones.filter(o => ops.includes(o.id)).map(o => o.texto) : []; }

export default function RuteoFlujo({ f, d, rotas = [], avisos = [] }) {
    const gs = ord(d, 'grupos');
    const filas = f.reglas.map((r, i) => {
        const cs = r.cond.filter(c => c.q && c.ops.length)
            .map(c => { const q = f.preguntas.find(x => x.id === c.q); return q ? opsTxt(q, c.ops).join(' o ') : ''; }).filter(Boolean);
        return { k: r.id, t: 'Regla ' + (i + 1), d: cs.length ? cs.join(' · ') : 'Sin condiciones', g: r.grupo, rota: rotas.includes(i), aviso: avisos.includes(i) };
    }).concat([{ k: 'resto', t: 'Todo lo demás', d: 'Cualquier otra respuesta', g: f.resto, resto: true }]);
    const filtra = f.preguntas.some(q => q.opciones.some(o => o.descalifica));

    return (
        <div className="rf">
            <div className="rf-inicio">
                <span className="rf-ico"><Icono n="form" s={18} /></span>
                <b>{f.nombre || 'Formulario'}</b>
                <span>{f.preguntas.length + CONTACTO.length} preguntas</span>
            </div>
            <div className="rf-ramas">
                {filas.map(fi => {
                    const g = buscar(d, 'grupos', fi.g), gi = gs.indexOf(g);
                    const ms = g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean) : [];
                    return (
                        <div className="rf-fila" key={fi.k}>
                            <div className={'rf-regla' + (fi.resto ? ' rf-regla--resto' : '') + (fi.aviso ? ' rf-regla--aviso' : '')}>
                                <b>{fi.t}{fi.rota && <span title="Usa una pregunta o respuesta que ya no existe" style={{ color: 'var(--warning)', marginLeft: 6, verticalAlign: '-2px' }}><Icono n="alerta" s={13} /></span>}</b>
                                <span title={fi.d}>{fi.d}</span>
                            </div>
                            <span className="rf-flecha" aria-hidden="true" />
                            <div className="rf-prio" style={{ '--c': g ? colorNivel(gi + 1) : 'var(--warning)' }}>
                                <div className="rf-prio-cab">
                                    <span className="prio num">{g ? gi + 1 : '!'}</span>
                                    <b>{g ? g.nombre : 'Sin estrategia'}</b>
                                    {g && <span className="rf-est"><Icono n={ICO_EST[g.estrategia]} s={13} />{ESTRATEGIAS[g.estrategia]}</span>}
                                </div>
                                {ms.length ? (
                                    <div className="rf-closers">
                                        {ms.map((p, j) => (
                                            <React.Fragment key={p.id}>
                                                {j > 0 && <i aria-hidden="true">{g.estrategia === 'repartir' ? '·' : <Icono n="chevron-right" s={12} />}</i>}
                                                <span className="rf-closer"><Avatar p={p} clase="avatar--sm" />{p.nombre}</span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ) : <span className="t-cap mut40">{g ? 'Sin closers: pasa a la siguiente estrategia' : 'Sin closers'}</span>}
                            </div>
                        </div>
                    );
                })}
                {filtra && (
                    <div className="rf-fila">
                        <div className="rf-regla rf-regla--no"><b>No califica</b><span>Respuesta que descalifica</span></div>
                        <span className="rf-flecha rf-flecha--no" aria-hidden="true" />
                        <div className="rf-prio rf-prio--no"><div className="rf-prio-cab"><Icono n="prohibido" s={16} /><b>{f.fin.titulo || 'Pantalla de fin'}</b></div></div>
                    </div>
                )}
            </div>
        </div>
    );
}
