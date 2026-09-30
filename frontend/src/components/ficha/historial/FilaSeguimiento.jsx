import React, { useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { diaLegible, instanteLegible } from '../piezas/fecha';
import { localToday } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import BorrarConConfirmacion from './BorrarConConfirmacion';
import Desplegable from './Desplegable';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * Una fila de la sección «Seguimientos» del historial, con su estado y su editor en el sitio.
 *
 * Pedido del usuario (29/09/2026): «En los seguimientos deberían poder crearse seguimientos y
 * cambiar el estado de los seguimientos». El estado se cambia en la fila, de un toque, con el
 * control «Pendiente | Realizado»; el lápiz abre debajo el resto de lo que la fila muestra: el
 * día, el tipo y la nota. Se guarda con UN pedido (`corregir_seguimiento`) apuntado a la agenda
 * de la que cuelga el seguimiento, y solo con lo que cambió.
 *
 * El intento se muestra pero no se corrige: es la cuenta de contactos de la cadencia y la lleva
 * el closer desde su pestaña.
 */

/** Cómo está el seguimiento para quien lo mira: lo guardado, y si ya se le pasó el día. */
export const estadoDeSeguimiento = (s, hoy = localToday()) => {
    if (s?.realizado) return { clave: 'realizado', label: 'Realizado', tono: 'success' };
    if (s?.fecha && String(s.fecha).slice(0, 10) < hoy) {
        return { clave: 'atrasado', label: 'Atrasado', tono: 'error' };
    }
    return { clave: 'pendiente', label: 'Pendiente', tono: 'info' };
};

export const etiquetaDeTipo = (tipos, clave) => tipos.find(t => t.clave === clave)?.label || clave;

const OPCIONES_ESTADO = [
    { realizado: false, label: 'Pendiente' },
    { realizado: true, label: 'Realizado' },
];

/**
 * «Pendiente | Realizado». La marca se corre de una opción a la otra al tocar (`layoutId`, con un
 * id por fila) y se corre ANTES de que vuelva la respuesta: si el pedido falla, vuelve a su lugar.
 * Con movimiento reducido salta sin animar.
 */
const EstadoSeguimiento = ({ realizado, cual, disabled, onCambiar }) => {
    const reducido = useReducedMotion();
    const marca = useId();
    return (
        <div className="fi-seg fi-seg--sm" role="group" aria-label={`Estado del seguimiento ${cual}`}>
            {OPCIONES_ESTADO.map((o) => {
                const activo = o.realizado === realizado;
                return (
                    <button key={o.label} type="button" className="fi-seg-op" aria-pressed={activo}
                        disabled={disabled} onClick={() => { if (!activo) onCambiar(o.realizado); }}>
                        {activo && (
                            <motion.span className="fi-seg-marca" aria-hidden="true"
                                {...(reducido ? {} : {
                                    layoutId: `fi-seg-seguimiento-${marca}`,
                                    transition: { type: 'spring', bounce: 0.18, duration: 0.36 },
                                })} />
                        )}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
};

const FilaSeguimiento = ({
    seguimiento: s, tipos = [], mostrarAgenda = false, puedeEditar = false, onCorregir, onBorrar,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const lapiz = useRef(null);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // El estado que se acaba de tocar, mientras el pedido viaja: la marca se mueve ya.
    const [enVuelo, setEnVuelo] = useState(null);
    const [dia, setDia] = useState('');
    const [tipo, setTipo] = useState('');
    const [nota, setNota] = useState('');
    // Por qué no se guardó el último intento: el estado de la fila o el editor. Se dibuja adentro
    // del editor si está abierto, y si no, debajo de la fila.
    const [error, setError] = useState(null);

    const diaInicial = s.fecha ? String(s.fecha).slice(0, 10) : '';
    const realizado = enVuelo ?? !!s.realizado;
    const estado = estadoDeSeguimiento({ ...s, realizado });
    const fecha = diaLegible(s.fecha) || 'Sin fecha';
    // Cómo lo nombran los lectores de pantalla: «del 6 oct 2026» o «sin fecha».
    const cual = s.fecha ? `del ${fecha}` : 'sin fecha';

    const abrir = () => {
        setDia(diaInicial);
        setTipo(s.tipo || '');
        setNota(s.nota || '');
        setError(null);
        setEditando(true);
    };

    // Al cerrar, el foco vuelve al lápiz: el editor desaparece y, si no, quedaría en el `body`.
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

    const cambiarEstado = async (valor) => {
        setEnVuelo(valor);
        setError(null);
        try {
            await onCorregir?.({ realizado: valor });
        } catch (err) {
            // La marca vuelve a donde estaba, y el motivo se dice en la fila: el aviso del
            // cascarón queda arriba del panel, fuera de la vista.
            setError(mensajeDeError(err));
        } finally {
            setEnVuelo(null);
        }
    };

    // Solo viaja lo que cambió: la bitácora dice exactamente qué se tocó. El día no se borra (sin
    // día el seguimiento pasaría al pool «Asignar fecha» del closer, que es otra cosa).
    const cambios = {};
    if (editando) {
        if (dia && dia !== diaInicial) cambios.fecha = dia;
        if (tipo && tipo !== (s.tipo || '')) cambios.tipo = tipo;
        if (nota.trim() !== (s.nota || '')) cambios.nota = nota.trim();
    }
    const hayCambios = Object.keys(cambios).length > 0;

    const guardar = async () => {
        if (!hayCambios) return;
        setGuardando(true);
        setError(null);
        try {
            await onCorregir?.(cambios);
            cerrar();
        } catch (err) {
            // El editor se queda abierto con lo escrito y dice por qué, para corregir sin volver
            // a empezar.
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    const tipoActual = tipos.find(t => t.clave === tipo);
    const meta = [
        s.tipo ? etiquetaDeTipo(tipos, s.tipo) : 'Sin tipo',
        s.intento > 1 ? `Seguimiento ${s.intento} de 4` : null,
        mostrarAgenda && s.agenda_fecha ? `de la agenda del ${instanteLegible(s.agenda_fecha)}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="fi-seguimiento" data-editando={editando || undefined}>
            <div className="fi-sec-fila">
                <span style={{ display: 'grid', gap: 2 }}>
                    <span className="t-sm mut num">{fecha}</span>
                    {estado.clave === 'atrasado' && (
                        <small className="t-cap" style={{ color: 'var(--error)', fontWeight: 700 }}>
                            Atrasado
                        </small>
                    )}
                </span>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span className={`t-sm trunc${s.nota ? '' : ' mut'}`} title={s.nota || undefined}>
                        {s.nota || 'Sin nota'}
                    </span>
                    <small className="t-cap mut trunc" title={meta}>{meta}</small>
                </span>
                <span className="fila" style={{ gap: 'var(--s2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {puedeEditar ? (
                        <>
                            <EstadoSeguimiento realizado={realizado} cual={cual}
                                disabled={enVuelo !== null || guardando} onCambiar={cambiarEstado} />
                            <button type="button" className="ibtn ibtn--sm" ref={lapiz}
                                aria-expanded={editando}
                                aria-controls={`${ids}-editor`}
                                aria-label={`Corregir día, tipo y nota del seguimiento ${cual}`}
                                title="Corregir día, tipo y nota"
                                onClick={() => (editando ? cerrar() : abrir())}>
                                <Pencil />
                            </button>
                            {/* Eliminarlo lo saca también de la pestaña Seguimientos del closer,
                                aunque la agenda sea un No Show (ver el borrado del backend). */}
                            <BorrarConConfirmacion etiqueta={`Eliminar el seguimiento ${cual}`}
                                titulo="¿Eliminar este seguimiento?" confirmar="Eliminar seguimiento"
                                disabled={enVuelo !== null || guardando} onBorrar={() => onBorrar?.()}>
                                <span><strong>{fecha}</strong> · {meta}</span>
                                <span>Deja de aparecer en la pestaña Seguimientos del closer.</span>
                            </BorrarConConfirmacion>
                        </>
                    ) : (
                        <span className="chip" style={{ '--c': `var(--${estado.tono})` }}>{estado.label}</span>
                    )}
                </span>
            </div>

            {!editando && <MotivoDelFallo motivo={error} />}

            {editando && (
                <motion.div id={`${ids}-editor`} className="fi-agenda-editor"
                    role="group" aria-label={`Corregir el seguimiento ${cual}`}
                    onKeyDown={(e) => {
                        if (e.key !== 'Escape') return;
                        // Escape cierra ESTE editor y nada más: el cascarón escucha Escape en
                        // `document` para cerrar la ficha entera.
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
                            <label className="t-rotulo" htmlFor={`${ids}-dia`}>Día del contacto</label>
                            <span className="ln-field" style={{ height: 44 }}>
                                <input id={`${ids}-dia`} type="date" value={dia} required
                                    disabled={guardando} autoFocus
                                    onChange={(e) => cambiarCon(setDia)(e.target.value)} />
                            </span>
                        </div>

                        <div className="fi-campo">
                            <label className="t-rotulo" htmlFor={`${ids}-tipo`}>Tipo</label>
                            <Desplegable id={`${ids}-tipo`} etiqueta="Tipo de seguimiento" valor={tipo}
                                disabled={guardando} onCambiar={cambiarCon(setTipo)}>
                                {!s.tipo && <option value="">Sin tipo · elegí uno</option>}
                                {tipos.map(t => <option key={t.clave} value={t.clave}>{t.label}</option>)}
                            </Desplegable>
                            {tipoActual?.desc && <small className="t-cap mut">{tipoActual.desc}</small>}
                        </div>

                        <div className="fi-campo">
                            <label className="t-rotulo" htmlFor={`${ids}-nota`}>Nota</label>
                            <span className="ln-field" style={{ height: 44 }}>
                                <input id={`${ids}-nota`} value={nota} maxLength={255}
                                    placeholder="Qué hay que hacer" disabled={guardando}
                                    onChange={(e) => cambiarCon(setNota)(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} />
                            </span>
                        </div>
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
        </div>
    );
};

export default FilaSeguimiento;
