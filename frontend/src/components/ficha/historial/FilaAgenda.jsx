import React, { useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { instanteLegible } from '../piezas/fecha';
import {
    datetimeLocalToUtcIso, toDatetimeLocalValue, viewerTimezoneLabel,
} from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import { etiquetaDeFuente, gruposDeFuente } from '../fuentes';
import BorrarConConfirmacion from './BorrarConConfirmacion';
import Desplegable from './Desplegable';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * Una fila de la sección «Agendas» del historial, con su editor en el sitio.
 *
 * Pedido del usuario (29/09/2026): «En las agendas debería poder modificar lo que se ve de las
 * agendas: la fecha, la hora, los estados, la fuente...». Los estados ya se corregían con los dos
 * desplegables de la fila (`children`, que siguen ahí); el lápiz abre debajo el resto: fecha y
 * hora, fuente y —si el rol puede reasignar— el closer. Se guarda con UN pedido
 * (`editar_agenda`) y solo con lo que cambió, así la bitácora dice exactamente qué se tocó.
 *
 * La hora que se ve y se escribe es la de quien mira: `start_time` viaja en UTC, se muestra con
 * `instanteLegible` y se manda convertida con `datetimeLocalToUtcIso`. Al lado del campo se dice en
 * qué reloj está, porque el closer y la dirección no siempre están en el mismo país.
 *
 * La papelera borra la agenda, con un modal de la página que pide confirmación (pedido del
 * usuario, 29/09/2026: "no se pueden eliminar agendas desde el historial, eso también debe poder
 * hacerlo cualquiera, y que muestre un modal de confirmación de la página, no del navegador"). Es
 * un modal y no el «¿Seguro?» en el lugar de `InlineConfirm` que usan los pagos porque borrar una
 * agenda se lleva su registro de eventos y no hay deshacer: el diálogo dice qué se borra.
 */

// `pie` va debajo de la fila (y de su editor), dentro de la misma franja: la objeción de una
// llamada que no cerró (`ObjecionDeAgenda`).
const FilaAgenda = ({
    agenda, fuentes = [], closers = [], puedeEditar = false, puedeReasignar = false, onEditar,
    puedeBorrar = false, unica = false, onBorrar, children = null, pie = null,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const lapiz = useRef(null);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [cuando, setCuando] = useState('');
    const [fuente, setFuente] = useState('');
    const [closerId, setCloserId] = useState('');
    const [error, setError] = useState(null);

    const cuandoInicial = toDatetimeLocalValue(agenda.fecha);
    const grupos = gruposDeFuente(fuentes, agenda.fuente, agenda.fuente_label);
    // El closer actual va siempre en la lista aunque ya no esté activo: sin él, el desplegable
    // arrancaría mostrando a otro y parecería que la agenda es de ese.
    const opcionesCloser = closers.some(c => String(c.id) === String(agenda.closer_id)) || !agenda.closer_id
        ? closers
        : [{ id: agenda.closer_id, nombre: agenda.closer || 'Closer actual', pista: 'Inactivo' }, ...closers];
    const conCloser = puedeReasignar && opcionesCloser.length > 0;

    const abrir = () => {
        setCuando(cuandoInicial);
        setFuente(agenda.fuente || '');
        setCloserId(agenda.closer_id != null ? String(agenda.closer_id) : '');
        setError(null);
        setEditando(true);
    };

    // Al cerrar, el foco vuelve al lápiz: el editor desaparece y, si no, quedaría en el `body` y
    // quien usa el teclado tendría que volver a recorrer la ficha desde arriba.
    const cerrar = () => {
        setEditando(false);
        setError(null);
        lapiz.current?.focus();
    };

    // Cambiar un campo borra el motivo del intento anterior: ya habla de otros datos.
    const cambiarCon = (set) => (valor) => {
        setError(null);
        set(valor);
    };

    // Solo viaja lo que cambió: la bitácora del backend dice exactamente qué se tocó, y un campo
    // que no se tocó no puede fallar (una fuente vieja fuera del catálogo, por ejemplo).
    const cambios = {};
    if (editando) {
        if (cuando && cuando !== cuandoInicial) cambios.fecha = datetimeLocalToUtcIso(cuando);
        if (fuente && fuente !== (agenda.fuente || '')) cambios.fuente = fuente;
        if (conCloser && closerId && closerId !== String(agenda.closer_id ?? '')) {
            cambios.closer_id = Number(closerId);
        }
    }
    const hayCambios = Object.keys(cambios).length > 0;

    const guardar = async () => {
        if (!hayCambios) return;
        setGuardando(true);
        setError(null);
        try {
            await onEditar?.(cambios);
            cerrar();
        } catch (err) {
            // El motivo va acá, al lado del botón (ej. el closer tiene otra llamada a esa hora): el
            // aviso del cascarón queda arriba del panel, fuera de la vista. El editor se queda
            // abierto con lo elegido, para corregir sin volver a empezar.
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    const fecha = instanteLegible(agenda.fecha) || '—';
    // La etiqueta del backend primero: la lista ya no trae todas las fuentes que una agenda puede
    // tener (la grabación del workshop, por ejemplo), y sin ella la fila decía la clave cruda.
    const etiqueta = agenda.fuente_label || (agenda.fuente ? etiquetaDeFuente(fuentes, agenda.fuente) : null);
    const quien = [etiqueta, agenda.closer]
        .filter(Boolean).join(' · ') || agenda.detalle || 'Sin detalle';

    return (
        <div className="fi-agenda" data-editando={editando || undefined}>
            <div className="fi-sec-fila fi-agenda-fila">
                <span className="t-sm mut num">{fecha}</span>
                {/* El nombre largo («Entrevista Diagnóstica Gratuita con la Dra. …») se corta con
                    puntos suspensivos y se lee entero al pasar el mouse o al abrir el editor. */}
                <span className="t-sm trunc" title={quien}>{quien}</span>
                <span className="fila" style={{ gap: 'var(--s2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {children}
                    {puedeEditar && (
                        <button type="button" className="ibtn ibtn--sm" ref={lapiz}
                            aria-expanded={editando}
                            aria-controls={`${ids}-editor`}
                            aria-label={`Corregir fecha, fuente y closer de la agenda del ${fecha}`}
                            title="Corregir fecha, fuente y closer"
                            onClick={() => (editando ? cerrar() : abrir())}>
                            <Pencil />
                        </button>
                    )}
                    {puedeBorrar && (
                        <BorrarConConfirmacion etiqueta={`Eliminar la agenda del ${fecha}`}
                            titulo="¿Eliminar esta agenda?" confirmar="Eliminar agenda"
                            onBorrar={() => onBorrar?.()}>
                            <span><strong>{fecha}</strong>{quien ? ` · ${quien}` : ''}</span>
                            <span>
                                Se borra con su registro de eventos. No se puede deshacer.
                                {unica && ' Es la única agenda de este lead.'}
                            </span>
                        </BorrarConConfirmacion>
                    )}
                </span>
            </div>

            {editando && (
                <motion.div id={`${ids}-editor`} className="fi-agenda-editor"
                    role="group" aria-label={`Corregir la agenda del ${fecha}`}
                    onKeyDown={(e) => {
                        if (e.key !== 'Escape') return;
                        // Escape cierra ESTE editor y nada más: sin cortar la propagación, el
                        // listener del cascarón en `document` cerraba la ficha entera.
                        e.stopPropagation();
                        cerrar();
                    }}
                    {...(reducido ? {} : {
                        initial: { opacity: 0, y: -6 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
                    })}>
                    <div className="fi-agenda-campos">
                        <div className="fi-campo">
                            <div className="fi-campo-cab">
                                <label className="t-rotulo" htmlFor={`${ids}-cuando`}>Fecha y hora</label>
                                <small className="t-cap mut">En tu hora · {viewerTimezoneLabel()}</small>
                            </div>
                            <span className="ln-field" style={{ height: 44 }}>
                                <input id={`${ids}-cuando`} type="datetime-local" value={cuando}
                                    disabled={guardando} autoFocus
                                    onChange={(e) => cambiarCon(setCuando)(e.target.value)} />
                            </span>
                        </div>

                        <div className="fi-campo">
                            <label className="t-rotulo" htmlFor={`${ids}-fuente`}>Fuente</label>
                            <Desplegable id={`${ids}-fuente`} etiqueta="Fuente de la agenda" valor={fuente}
                                disabled={guardando} onCambiar={cambiarCon(setFuente)}>
                                {!agenda.fuente && <option value="">Sin fuente · elegí una</option>}
                                {grupos.map(g => (
                                    <optgroup key={g.titulo} label={g.titulo}>
                                        {(g.opciones || []).map(o => (
                                            <option key={o.clave} value={o.clave}>{o.label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Desplegable>
                        </div>

                        {conCloser && (
                            <div className="fi-campo">
                                <label className="t-rotulo" htmlFor={`${ids}-closer`}>Closer</label>
                                <Desplegable id={`${ids}-closer`} etiqueta="Closer de la agenda" valor={closerId}
                                    disabled={guardando} onCambiar={cambiarCon(setCloserId)}>
                                    {!agenda.closer_id && <option value="">Sin asignar</option>}
                                    {opcionesCloser.map(c => (
                                        <option key={c.id} value={String(c.id)}>
                                            {c.pista ? `${c.nombre} · ${c.pista}` : c.nombre}
                                        </option>
                                    ))}
                                </Desplegable>
                            </div>
                        )}
                    </div>

                    <MotivoDelFallo motivo={error} />

                    <div className="fi-agenda-pie">
                        <button type="button" className="btn btn--linea" disabled={guardando}
                            onClick={cerrar}>
                            Cancelar
                        </button>
                        <button type="button" className="btn btn--cta" disabled={guardando || !hayCambios}
                            title={hayCambios ? undefined : 'Todavía no cambiaste nada'}
                            onClick={guardar}>
                            {guardando && <span className="ln-spinner" />}
                            Guardar cambios
                        </button>
                    </div>
                </motion.div>
            )}
            {pie}
        </div>
    );
};

export default FilaAgenda;
