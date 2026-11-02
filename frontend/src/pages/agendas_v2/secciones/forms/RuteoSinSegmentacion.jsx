// Formulario sin segmentación: no hay reglas ni estrategias; cada link (evento) que lo usa agenda directo con
// la persona elegida en ese evento. Se listan esos links y se avisa el que no tiene persona (no ofrecería horarios).

import { buscar, ord as ordCol } from '../../core/datos';
import { Icono } from '../../ui/base';
import { abrirEvento } from '../eventos/comun';
import { Avatar, Button, Chip } from '../../../../components/standard';

export default function RuteoSinSegmentacion({ f, d }) {
    const eventos = ordCol(d, 'eventos').filter(e => e.formulario === f.id);
    return (
        <div className="sinseg">
            <p className="sinseg-txt">
                <Icono n="user" s={16} />
                Sin segmentación: el lead agenda directo con la persona elegida en cada link que usa este formulario.
            </p>
            {!eventos.length ? <p className="t-sm mut">Ningún link usa este formulario todavía.</p> : (
                <ul className="sinseg-lista">
                    {eventos.map(e => {
                        const p = buscar(d, 'personas', e.persona);
                        return (
                            <li key={e.id} className={p ? '' : 'sinseg--falta'}>
                                <span className="sinseg-ev"><Icono n="calendar" s={15} /><b>{e.nombre}</b><small>/{e.slug}</small></span>
                                {p ? <span className="sinseg-p"><Avatar name={p.nombre} size="sm" />{p.nombre}</span>
                                    : <Chip color="var(--error)" icon={<Icono n="alerta" s={13} />}>Sin persona: no ofrece horarios</Chip>}
                                {!e.activo && <Chip subtle>Pausado</Chip>}
                                <Button variant="ghost" onClick={() => abrirEvento(e.id)}>Abrir</Button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
