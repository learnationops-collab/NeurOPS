import React from 'react';
import Tip from './Tip';
import { fmt } from './Shared';

/**
 * El motivo de un No show, una cancelación o una reagenda en la lista de agendas de Revisar
 * (pedido de la dirección comercial, 03/11/2026): al pasar el mouse por el estado se lee por qué, y la
 * columna «Motivo» lo deja a la vista sin pasar el mouse.
 *
 * El backend manda `fila.motivo = {texto, quien, cuando, auto, nueva_cita}` solo en las filas que están en
 * uno de esos tres estados (`motivos_agenda.py`). `texto` es null si nadie lo escribió: lo marcado antes
 * del 02/11/2026, cuando se volvió obligatorio.
 */

// Los estados de cada chip que llevan motivo: la clave del chip, no su etiqueta.
const PIDEN_MOTIVO = { pre_call: ['cancelo'], post_call: ['no_show', 'reagendo', 'cancelo'] };

export const SIN_MOTIVO = 'Sin motivo registrado: se marcó antes de que fuera obligatorio.';

/** «30/10 12:40», en el reloj de quien mira. */
const cuando = (iso) => (iso ? `${fmt.fechaLocal(iso)} ${fmt.horaLocal(iso)}` : null);

/** La línea chica del globito: quién lo escribió, cuándo y, si se reagendó, la cita nueva. */
export const pieDe = (m) => [
    m.auto ? 'Registrado por el sistema' : [m.quien, cuando(m.cuando)].filter(Boolean).join(' · '),
    m.nueva_cita ? `Nueva cita: ${cuando(m.nueva_cita)}` : null,
].filter(Boolean).join(' · ') || undefined;

/** ¿Este chip (`pre_call` o `post_call`) de la fila lleva motivo? */
export const llevaMotivo = (fila, grupo) => !!fila.motivo
    && PIDEN_MOTIVO[grupo].includes(fila[grupo]?.key);

/** El chip del estado con el motivo en un globito al pasar el mouse. `chip`: el nodo ya dibujado. */
export const ConMotivo = ({ fila, grupo, chip }) => (
    <Tip ancla={chip} titulo={fila[grupo].label} texto={fila.motivo.texto || SIN_MOTIVO}
        pie={pieDe(fila.motivo)} />
);

/** La celda «Motivo»: el texto (cortado con «…» si no entra, entero en el `title`) o un guion. */
export const CeldaMotivo = ({ fila }) => {
    const m = fila.motivo;
    if (!m) return <span className="celda mut40">—</span>;
    if (!m.texto) return <span className="celda mut40" title={SIN_MOTIVO}>Sin motivo</span>;
    return (
        <span className="celda" title={`${m.texto}${pieDe(m) ? `\n${pieDe(m)}` : ''}`}>
            {m.texto}
        </span>
    );
};
