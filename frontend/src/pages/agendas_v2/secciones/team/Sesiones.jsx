// Duración de las sesiones y margen después de cada una, en minutos. La propuesta es la del evento (la
// pone la dirección comercial); cada closer la ajusta en su Configuración y la dirección la revisa acá
// (persona.sesiones = {eventoId: {duracion?, margen?}}). El margen bloquea la agenda pero el lead no lo ve.

import { useState } from 'react';
import { DURACIONES, DURACION_MAX, DURACION_MIN, MARGENES, MARGEN_MAX } from '../../core/catalogos';
import { entero } from '../../core/util';
import { Avatar, Icono, Sx } from '../../ui/base';

const OTRO = 'otro';

/** Minutos con atajos y «Otro…» para un valor a medida. `margen`: atajos de margen (0 = sin margen). */
export function CampoMinutos({ valor, onCambio, margen = false, label, id, disabled }) {
    const atajos = margen ? MARGENES : DURACIONES;
    const [aMedida, setAMedida] = useState(false);
    const libre = aMedida || !atajos.includes(valor);
    const [min, max] = margen ? [0, MARGEN_MAX] : [DURACION_MIN, DURACION_MAX];
    const confirmar = (t) => {
        const v = entero(t, min, max, valor);
        if (v !== valor) onCambio(v);
    };
    return (
        <div className="ses-min">
            <Sx sm id={id} label={label} valor={libre ? OTRO : String(valor)} disabled={disabled}
                onChange={v => { if (v === OTRO) setAMedida(true); else { setAMedida(false); onCambio(Number(v)); } }}
                opciones={atajos.map(n => ({ v: String(n), n: margen && !n ? 'Sin margen' : n + ' min', icono: 'clock' }))
                    .concat([{ v: OTRO, n: 'Otro…', icono: 'edit', color: 'var(--brand-secondary)' }])} />
            {libre && (
                <span className="ses-otro">
                    <input key={valor} className="input input--num num" type="number" inputMode="numeric" min={min} max={max}
                        aria-label={label + ' en minutos'} defaultValue={valor} disabled={disabled}
                        onBlur={e => confirmar(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                    <span className="t-sm mut">min</span>
                </span>
            )}
        </div>
    );
}

export const textoSesion = (dur, margen) => dur + ' min' + (margen ? ' + ' + margen + ' de margen' : '');

/** Una fila: quién o qué, su sesión y su margen, y si es la propuesta o algo ajustado. */
export function FilaSesion({ titulo, persona, propuesta, propia, onCambio, bloqueado, idBase }) {
    const dur = propia && propia.duracion != null ? propia.duracion : propuesta.duracion;
    const margen = propia && propia.margen != null ? propia.margen : propuesta.margen;
    const ajustada = !!propia && Object.keys(propia).length > 0;
    const set = (campo, v) => onCambio({ ...(propia || {}), [campo]: v });
    return (
        <div className={'ses-fila' + (ajustada ? ' ses-fila--propia' : '')}>
            <div className="ses-quien">
                {persona && <Avatar p={persona} clase="avatar--sm" />}
                <div>
                    <b className="trunc">{titulo}</b>
                    <span className="t-sm mut">{ajustada ? 'Propuesta: ' + textoSesion(propuesta.duracion, propuesta.margen) : 'Usa la propuesta'}</span>
                </div>
            </div>
            <label className="ses-campo"><span>Sesión</span>
                <CampoMinutos id={idBase + '-dur'} label={'Sesión de ' + titulo} valor={dur} disabled={bloqueado} onCambio={v => set('duracion', v)} />
            </label>
            <label className="ses-campo"><span>Margen</span>
                <CampoMinutos margen id={idBase + '-mar'} label={'Margen de ' + titulo} valor={margen} disabled={bloqueado} onCambio={v => set('margen', v)} />
            </label>
            {ajustada && !bloqueado
                ? <button type="button" className="link-btn link-btn--sutil ses-volver" onClick={() => onCambio(null)}><Icono n="volver" s={13} />Usar la propuesta</button>
                : <span className="ses-volver" />}
        </div>
    );
}

// Copia de `sesiones` con lo de un evento cambiado (null: vuelve a la propuesta).
export function conSesion(sesiones, eventoId, propia) {
    const out = { ...(sesiones || {}) };
    if (propia && Object.keys(propia).length) out[eventoId] = propia; else delete out[eventoId];
    return out;
}

/** Las sesiones de una persona en cada evento compartido. */
export function EditorSesiones({ eventos, sesiones, onCambio, bloqueado = false }) {
    if (!eventos.length) return <p className="t-sm mut">Todavía no hay eventos para ajustar.</p>;
    return (
        <div className="ses-lista">
            {eventos.map(e => (
                <FilaSesion key={e.id} idBase={'ses-' + e.id} titulo={e.nombre + (e.activo === false ? ' (pausado)' : '')}
                    propuesta={{ duracion: e.duracion, margen: e.margen || 0 }} propia={(sesiones || {})[e.id]} bloqueado={bloqueado}
                    onCambio={propia => onCambio(conSesion(sesiones, e.id, propia))} />
            ))}
        </div>
    );
}

/** Lo de cada closer en un evento: para revisar y personalizar desde el evento. */
export function SesionesDelEvento({ e, personas, onCambio, bloqueado = false }) {
    if (!personas.length) return <p className="t-sm mut">Sumá closers en Team.</p>;
    return (
        <div className="ses-lista">
            {personas.map(p => (
                <FilaSesion key={p.id} idBase={'ses-' + e.id + '-' + p.id} titulo={p.nombre} persona={p}
                    propuesta={{ duracion: e.duracion, margen: e.margen || 0 }} propia={(p.sesiones || {})[e.id]} bloqueado={bloqueado}
                    onCambio={propia => onCambio(p, conSesion(p.sesiones, e.id, propia))} />
            ))}
        </div>
    );
}
