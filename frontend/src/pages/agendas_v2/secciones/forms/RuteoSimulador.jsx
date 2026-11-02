// Probar un lead: se eligen sus respuestas y se ve qué regla se cumple, a qué estrategia va, con quién y en qué sesión.
// Usa el mismo ruteo que la página de reserva (grupoPorReglas), así lo que se ve acá es lo que le pasa al lead.

import { useState } from 'react';
import { buscar, ord as ordCol } from '../../core/datos';
import { grupoPorReglas, preguntasRuteo } from '../../core/formulario';
import { segmentar } from '../../core/segmento';
import { Icono, Sx } from '../../ui/base';
import { textoEstrategia } from '../team/cobertura';
import { colorNivel } from './comun';
import { Avatar, Chip } from '../../../../components/standard';

// Las preguntas que usa alguna regla, con al menos una respuesta escrita.
function preguntasDeReglas(f) {
    const usadas = new Set(f.reglas.flatMap(r => r.cond.map(c => c.q)));
    return preguntasRuteo(f).filter(q => usadas.has(q.id) && q.opciones.some(o => o.texto.trim()));
}

function Condiciones({ r, qs }) {
    return (
        <ul className="sim-conds">
            {r.cond.filter(c => c.q && c.ops.length).map((c, j) => {
                const q = qs.find(x => x.id === c.q);
                const ops = q ? q.opciones.filter(o => c.ops.includes(o.id)).map(o => o.texto) : [];
                return <li key={j}><b>{q ? q.corto || q.titulo : 'Pregunta'}</b><span>{ops.join(' o ')}</span></li>;
            })}
        </ul>
    );
}

export default function RuteoSimulador({ f, d }) {
    const qs = preguntasDeReglas(f);
    const [resp, setResp] = useState({});
    const actual = Object.fromEntries(qs.map(q => [q.id, resp[q.id] || q.opciones.find(o => o.texto.trim()).id]));
    const ruteo = grupoPorReglas(f, actual);
    const regla = ruteo.regla != null ? f.reglas[ruteo.regla] : null;
    const g = buscar(d, 'grupos', ruteo.grupo);
    const i = ordCol(d, 'grupos').indexOf(g);
    const color = g ? colorNivel(i + 1) : 'var(--idle)';
    const evento = buscar(d, 'eventos', regla ? regla.evento : '');
    const seg = segmentar(f, actual);
    const miembros = g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(Boolean) : [];

    if (!qs.length) return <p className="t-sm mut">Armá reglas para poder probar un lead.</p>;
    return (
        <div className="sim">
            <div className="sim-form">
                {qs.map(q => (
                    <label key={q.id} className="sim-q">
                        <span className="sim-q-t">{q.corto || q.titulo}</span>
                        <Sx sm label={q.titulo} valor={actual[q.id]} onChange={v => setResp(r => ({ ...r, [q.id]: v }))}
                            opciones={q.opciones.filter(o => o.texto.trim()).map(o => ({ v: o.id, n: o.texto }))} />
                    </label>
                ))}
            </div>
            <div className="sim-res" style={{ '--c': color }} aria-live="polite">
                <span className="sim-eyebrow">{regla ? 'Regla ' + (ruteo.regla + 1) : 'Todo lo demás'}</span>
                <h3 className="sim-dest"><Icono n="estrella" s={18} />{g ? g.nombre : ruteo.url ? 'Otra página' : 'Sin estrategia'}</h3>
                {miembros.length > 0 && (
                    <div className="sim-gente">
                        {miembros.map((p, k) => (
                            <span key={p.id} className="sim-p">{k > 0 && <Icono n="chevron-right" s={14} />}<Avatar name={p.nombre} size="sm" />{p.nombre}</span>
                        ))}
                    </div>
                )}
                {g && <p className="sim-txt">{textoEstrategia(d, g)}</p>}
                <div className="sim-chips">
                    <Chip>{evento ? evento.nombre : 'Sesión del link por el que agendó'}</Chip>
                    {seg && <Chip>Puntos {seg.puntos > 0 ? '+' : ''}{seg.puntos}</Chip>}
                </div>
                {regla ? <Condiciones r={regla} qs={qs} />
                    : <p className="sim-txt">Ninguna regla se cumple con estas respuestas.</p>}
            </div>
        </div>
    );
}
