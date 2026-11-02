// Simular: se eligen las respuestas de un lead y se ve qué regla se cumple, a qué estrategia va, con quién y en qué sesión.
// Usa el mismo ruteo que la página de reserva (grupoPorReglas), así lo que se ve acá es lo que le pasa al lead.

import { useState } from 'react';
import { ESTRATEGIAS } from '../../core/catalogos';
import { buscar, ord as ordCol } from '../../core/datos';
import { grupoPorReglas, preguntasRuteo } from '../../core/formulario';
import { segmentar } from '../../core/segmento';
import { Icono, Sx } from '../../ui/base';
import { textoEstrategia } from '../team/cobertura';
import { colorNivel } from './comun';
import { Avatar, Card, Chip } from '../../../../components/standard';

// Ícono de una pregunta según de qué habla (el formulario no lo guarda).
const ICONOS = [[/invert|plata|dinero|usd|\$/i, 'sube'], [/etapa|formaci/i, 'user'], [/examen|pa[ií]s/i, 'globo'],
    [/apoyo|decid|decisi/i, 'users'], [/trabaj/i, 'clock']];
const iconoDe = (q) => (ICONOS.find(([re]) => re.test(q.titulo)) || [null, 'opciones'])[1];
const nombreCorto = (q) => q.corto || q.titulo.replace(/[¿?]/g, '').split(/[.,]/)[0].slice(0, 40);

// Las preguntas que usa alguna regla, con al menos una respuesta escrita.
function preguntasDeReglas(f) {
    const usadas = new Set(f.reglas.flatMap(r => r.cond.map(c => c.q)));
    return preguntasRuteo(f).filter(q => usadas.has(q.id) && q.opciones.some(o => o.texto.trim()));
}

// Por qué cae en esa regla: en cada condición, la respuesta del lead y cuántas más también entran.
function PorQue({ r, qs, resp }) {
    return (
        <div className="sim-porque">
            <span className="sim-sub"><Icono n="check" s={14} />Por qué cae acá</span>
            <ul>
                {r.cond.filter(c => c.q && c.ops.length).map((c, j) => {
                    const q = qs.find(x => x.id === c.q);
                    if (!q) return null;
                    const elegida = q.opciones.find(o => o.id === resp[q.id]);
                    const otras = q.opciones.filter(o => c.ops.includes(o.id) && o.id !== resp[q.id]).map(o => o.texto);
                    return (
                        <li key={j} style={{ '--i': j }}>
                            <span className="sim-porque-q"><Icono n={iconoDe(q)} s={15} />{nombreCorto(q)}</span>
                            <span className="sim-porque-a">
                                <Chip icon={<Icono n="check" s={12} />} className="sim-ok">{elegida ? elegida.texto : '—'}</Chip>
                                {otras.length > 0 && <small title={otras.join(' · ')}>y {otras.length} respuesta{otras.length > 1 ? 's' : ''} más</small>}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function RuteoSimulador({ f, d }) {
    const qs = preguntasDeReglas(f);
    const [resp, setResp] = useState({});
    if (!qs.length) return <p className="t-sm mut">Armá reglas para poder simular un lead.</p>;

    const actual = Object.fromEntries(qs.map(q => [q.id, resp[q.id] || q.opciones.find(o => o.texto.trim()).id]));
    const ruteo = grupoPorReglas(f, actual);
    const regla = ruteo.regla != null ? f.reglas[ruteo.regla] : null;
    const g = buscar(d, 'grupos', ruteo.grupo);
    const color = g ? colorNivel(ordCol(d, 'grupos').indexOf(g) + 1) : 'var(--idle)';
    const evento = buscar(d, 'eventos', regla ? regla.evento : '');
    const seg = segmentar(f, actual);
    const miembros = g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean) : [];

    return (
        <div className="sim">
            <div className="sim-form">
                <span className="sim-sub"><Icono n="user" s={14} />Respuestas del lead</span>
                {qs.map(q => (
                    <label key={q.id} className="sim-q">
                        <span className="sim-q-ic" aria-hidden="true"><Icono n={iconoDe(q)} s={17} /></span>
                        <span className="sim-q-t">{nombreCorto(q)}</span>
                        <Sx sm label={q.titulo} valor={actual[q.id]} onChange={v => setResp(r => ({ ...r, [q.id]: v }))}
                            opciones={q.opciones.filter(o => o.texto.trim()).map(o => ({ v: o.id, n: o.texto }))} />
                    </label>
                ))}
            </div>
            <Card aura={[color, 'var(--brand-secondary)']} className="sim-res" style={{ '--c': color }} aria-live="polite">
                {/* La clave cambia con el destino: la tarjeta entra de nuevo y se nota el cambio. */}
                <div className="sim-in" key={(ruteo.regla ?? 'resto') + ':' + ruteo.grupo}>
                    <div className="sim-top">
                        <span className="sim-eyebrow">{regla ? 'Regla ' + (ruteo.regla + 1) : 'Todo lo demás'} · va a</span>
                        {seg && (
                            <span className="sim-puntos" title="Puntos del segmento">
                                <b>{seg.puntos > 0 ? '+' : ''}{seg.puntos}</b><small>puntos</small>
                            </span>
                        )}
                    </div>
                    <h3 className="sim-dest">
                        <span className="sim-dest-ic" aria-hidden="true"><Icono n="estrella" s={20} /></span>
                        {g ? g.nombre : ruteo.url ? 'Otra página' : 'Sin estrategia'}
                    </h3>
                    {miembros.length > 0 && (
                        <div className="sim-gente">
                            {miembros.map((p, k) => (
                                <span key={p.id} className="sim-p" style={{ '--i': k }}>
                                    {k > 0 && <Icono n="chevron-right" s={14} />}
                                    <span className="sim-av"><Avatar name={p.nombre} size="sm" /><i>{k + 1}</i></span>{p.nombre}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="sim-datos">
                        {g && <Chip icon={<Icono n="rayo" s={13} />} subtle>{ESTRATEGIAS[g.estrategia] || 'Llenar agenda'}</Chip>}
                        <Chip icon={<Icono n="calendar" s={13} />} subtle>{evento ? evento.nombre : 'Sesión del link por el que agendó'}</Chip>
                    </div>
                    {g && <p className="sim-txt">{textoEstrategia(d, g)}</p>}
                    {regla ? <PorQue r={regla} qs={qs} resp={actual} />
                        : <p className="sim-txt">Ninguna regla se cumple con estas respuestas: va a «Todo lo demás».</p>}
                </div>
            </Card>
        </div>
    );
}
