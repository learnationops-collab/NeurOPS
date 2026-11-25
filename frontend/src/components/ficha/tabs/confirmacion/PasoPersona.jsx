import React from 'react';
import { Users } from 'lucide-react';
import { Avatar, Segmented } from '../../../standard';
import { CUALQUIERA } from './reprogramar';

const cuenta = (n) => (n === 0 ? 'Sin horarios libres' : `${n} ${n === 1 ? 'horario libre' : 'horarios libres'}`);

/** Paso 1: con quién queda la llamada. Primero el grupo (closers o triage) y después una persona o
 *  «cualquiera» (se ofrecen los horarios de todo el grupo). */
const PasoPersona = ({ rol, onRol, personas, porPersona, actualId, elegida, onElegir, totalGrupo }) => {
    const delGrupo = personas
        .filter((p) => p.rol === rol)
        .map((p) => ({ ...p, n: (porPersona[String(p.id)] || []).length }))
        .sort((a, b) => (b.id === actualId) - (a.id === actualId) || b.n - a.n);
    const actual = personas.find((p) => p.id === actualId);

    return (
        <div className="rp-paso">
            <div className="rp-fila">
                <Segmented size="sm" radio label="Grupo" value={rol} onChange={onRol}
                    options={[{ value: 'closer', label: 'Closers' }, { value: 'triage', label: 'Triage' }]} />
                {actual && (
                    <small className="t-cap mut">
                        {`La llamada es de ${actual.nombre} (${actual.rol}).`}
                    </small>
                )}
            </div>

            <div className="rp-personas">
                <button type="button" className="rp-persona" aria-pressed={elegida === CUALQUIERA}
                    disabled={totalGrupo === 0} onClick={() => onElegir(CUALQUIERA)}>
                    <span className="rp-persona-ico"><Users size={18} /></span>
                    <span className="rp-persona-txt">
                        <b>Cualquiera</b>
                        <small>{`Todos los horarios del grupo · ${totalGrupo}`}</small>
                    </span>
                </button>
                {delGrupo.map((p) => (
                    <button key={p.id} type="button" className="rp-persona" aria-pressed={elegida === p.id}
                        disabled={p.n === 0} onClick={() => onElegir(p.id)}>
                        <Avatar name={p.nombre} size="sm" />
                        <span className="rp-persona-txt">
                            <b>{p.nombre}{p.id === actualId && <em> · la actual</em>}</b>
                            <small>{cuenta(p.n)}</small>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PasoPersona;
