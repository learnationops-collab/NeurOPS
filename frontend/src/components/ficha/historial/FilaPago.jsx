import React, { useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { mensajeDeError } from '../fichaApi';
import { diaLegible } from '../piezas/fecha';
import ElegirTransferencia from '../piezas/ElegirTransferencia';
import { PREGUNTA_TRANSFERENCIA, esTransferencia, leyendaTransferencia } from '../transferencia';
import CamposPago, {
    etiquetaDeTipo, faltaParaGuardar, montoExacto, nombreDePrograma,
} from './CamposPago';
import BorrarConConfirmacion from './BorrarConConfirmacion';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * Una fila de la sección «Pagos» del historial, con su editor en el sitio y su borrado.
 *
 * Pedido del usuario (29/09/2026): «en los pagos también debería ser fácil crear y modificar
 * pagos, sin automatizaciones. Solo es para modificar en caso de haber algún error». El lápiz abre
 * debajo la fecha, el monto, el medio, el programa y el tipo; se guarda con UN pedido
 * (`corregir_pago`) y solo con lo que cambió. La papelera abre el modal de confirmación de la
 * página (`BorrarConConfirmacion`), como todo lo que se elimina en el historial: no hay endpoint
 * que devuelva el pago, y el modal dice cuál se borra.
 *
 * El backend mueve la venta y su registro en la deuda juntos, y no escribe en Google Sheets ni
 * avisa a nadie: el editor lo dice, porque «sin automatizaciones» es justamente lo que se pidió.
 *
 * La fecha de un pago es un DÍA, no un instante: se lee del texto con `diaLegible` y no se pasa por
 * el huso de quien mira, que solo podría correrla.
 *
 * Un pago por transferencia dice a quién del equipo se le hizo («Transferido a Jean Carlo») o que
 * está «Sin marcar» (pedido de Kerwin, 09/10/2026). Se cambia desde el lápiz, y uno sin marcar se
 * marca directo en la fila, con las tres opciones debajo: es lo que hay que hacer con los pagos de
 * antes, uno por uno, y abrir el editor entero para eso sobraba.
 */

const diaDe = (fecha) => (fecha ? String(fecha).slice(0, 10) : '');

const FilaPago = ({
    pago: p, medios = [], programas = [], tipos = [], transferencias = [], puedeEditar = false, onCorregir,
    onBorrar,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const lapiz = useRef(null);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [valores, setValores] = useState({});
    const [error, setError] = useState(null);

    const inicial = {
        fecha: diaDe(p.fecha), monto: p.monto != null ? String(p.monto) : '', medio: p.medio || '',
        programa: p.programa_code || '', tipo: p.tipo || '', transferido_a: p.transferido_a || null,
    };
    // El backend dice si es transferencia (`es_transferencia`); sin el dato, la misma regla acá.
    const esDeTransferencia = p.es_transferencia ?? esTransferencia(p.medio);
    const dia = diaLegible(p.fecha) || 'Sin fecha';
    const tipo = p.tipo ? etiquetaDeTipo(tipos, p.tipo) : (p.tipo_pago || 'Sin tipo');
    const detalle = [p.programa_code ? nombreDePrograma(programas, p.programa_code) : 'Sin programa',
        p.medio || 'Sin medio'].join(' · ');
    // Cómo lo nombran los lectores de pantalla: «de $300 del 15 sep 2026».
    const cual = `de ${montoExacto(p.monto)} del ${dia}`;

    const abrir = () => {
        setValores(inicial);
        setError(null);
        setEditando(true);
    };

    // Al cerrar, el foco vuelve al lápiz: el editor desaparece y, si no, quedaría en el `body`.
    const cerrar = () => {
        setEditando(false);
        setError(null);
        lapiz.current?.focus();
    };

    // Solo viaja lo que cambió: la bitácora dice exactamente qué se tocó, y un medio histórico que
    // nadie tocó no puede rebotar por estar fuera de la lista.
    const cambios = {};
    if (editando) {
        if (valores.fecha && valores.fecha !== inicial.fecha) cambios.fecha = valores.fecha;
        if (valores.monto !== '' && Number(valores.monto) !== Number(p.monto)) {
            cambios.monto = Number(valores.monto);
        }
        if (valores.medio && valores.medio !== inicial.medio) cambios.metodo_pago = valores.medio;
        if (valores.programa && valores.programa !== inicial.programa) {
            cambios.programa_code = valores.programa;
        }
        if (valores.tipo && valores.tipo !== inicial.tipo) cambios.tipo = valores.tipo;
        // A quién se le hizo la transferencia viaja solo si el medio que queda es transferencia:
        // si pasa a otro medio, el backend limpia la marca solo.
        if (esTransferencia(valores.medio) && (valores.transferido_a ?? null) !== inicial.transferido_a) {
            cambios.transferido_a = valores.transferido_a ?? null;
        }
    }
    const hayCambios = Object.keys(cambios).length > 0;
    const falta = editando
        ? faltaParaGuardar(valores, {
            cambiaTipo: !!cambios.tipo, cambiaFecha: !!cambios.fecha,
            // Pasar a transferencia es registrar una: se pide a quién, como en el alta.
            pideTransferencia: !esTransferencia(inicial.medio) && esTransferencia(valores.medio),
        })
        : null;

    // Marcar directo en la fila una transferencia sin marcar: un pedido con solo eso.
    const marcar = async (clave) => {
        setGuardando(true);
        setError(null);
        try {
            await onCorregir?.({ transferido_a: clave });
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };
    const marcarEnLaFila = puedeEditar && esDeTransferencia && !p.transferido_a && !editando;

    const guardar = async () => {
        if (!hayCambios || falta) return;
        setGuardando(true);
        setError(null);
        try {
            await onCorregir?.(cambios);
            cerrar();
        } catch (err) {
            // El editor se queda abierto con lo cargado y dice por qué, al lado del botón: el
            // aviso del cascarón queda arriba del panel, fuera de la vista.
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fi-pago" data-editando={editando || undefined}>
            <div className="fi-sec-fila">
                <span className="t-sm mut num">{dia}</span>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span className="t-sm trunc" title={p.tipo_pago || undefined}>{tipo}</span>
                    <small className="t-cap mut trunc" title={detalle}>{detalle}</small>
                    {esDeTransferencia && (
                        <span style={{ display: 'flex', minWidth: 0, marginTop: 2 }}>
                            <span className="chip"
                                style={{ '--c': p.transferido_a ? 'var(--info)' : 'var(--warning)' }}>
                                {leyendaTransferencia(transferencias, p.transferido_a)}
                            </span>
                        </span>
                    )}
                </span>
                <span className="fila" style={{ gap: 'var(--s2)', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    <span className="t-sm num" style={{ fontWeight: 600 }}>{montoExacto(p.monto)}</span>
                    {puedeEditar && (
                        <>
                            <button type="button" className="ibtn ibtn--sm" ref={lapiz}
                                aria-expanded={editando}
                                aria-controls={`${ids}-editor`}
                                aria-label={`Corregir el pago ${cual}`}
                                title={esDeTransferencia ? 'Corregir fecha, monto, medio, tipo y a quién se le hizo la transferencia'
                                    : 'Corregir fecha, monto, medio y tipo'}
                                onClick={() => (editando ? cerrar() : abrir())}>
                                <Pencil />
                            </button>
                            <BorrarConConfirmacion etiqueta={`Eliminar el pago ${cual}`}
                                titulo="¿Eliminar este pago?" confirmar="Eliminar pago"
                                disabled={guardando} onBorrar={() => onBorrar?.()}>
                                <span><strong>{montoExacto(p.monto)}</strong> · {dia} · {tipo}</span>
                                <span>Deja de contar como pagado. No se puede deshacer.</span>
                            </BorrarConConfirmacion>
                        </>
                    )}
                </span>
            </div>

            {marcarEnLaFila && (
                <motion.div className="fi-pago-marcar" role="group"
                    aria-label={`A quién se le hizo la transferencia ${cual}`}
                    {...(reducido ? {} : {
                        initial: { opacity: 0, y: -4 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
                    })}>
                    <small className="t-cap mut">{PREGUNTA_TRANSFERENCIA}</small>
                    <ElegirTransferencia chico opciones={transferencias} valor={null} disabled={guardando}
                        etiqueta={`${PREGUNTA_TRANSFERENCIA} (pago ${cual})`} onElegir={marcar} />
                    {guardando && <span className="ln-spinner" aria-label="Guardando" />}
                </motion.div>
            )}

            {!editando && <MotivoDelFallo motivo={error} />}

            {editando && (
                <motion.div id={`${ids}-editor`} className="fi-agenda-editor"
                    role="group" aria-label={`Corregir el pago ${cual}`}
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
                    <CamposPago ids={ids} valores={valores} disabled={guardando} autoFocus
                        onCambiar={(parche) => {
                            // Cambiar un campo borra el motivo del intento anterior.
                            setError(null);
                            setValores(v => ({ ...v, ...parche }));
                        }}
                        medios={medios} programas={programas} tipos={tipos} transferencias={transferencias}
                        actual={{ medio: p.medio, programa: p.programa_code, tipo: p.tipo,
                            tipoCrudo: p.tipo_pago, transferido_a: p.transferido_a }} />

                    <small className="t-cap mut">
                        Corrige el pago y lo que cuenta la deuda. No escribe en Google Sheets ni le avisa
                        a nadie.
                    </small>

                    <MotivoDelFallo motivo={error} />

                    <div className="fi-agenda-pie">
                        <button type="button" className="btn btn--linea" disabled={guardando}
                            onClick={cerrar}>
                            Cancelar
                        </button>
                        <button type="button" className="btn btn--cta"
                            disabled={guardando || !hayCambios || !!falta}
                            title={falta || (hayCambios ? undefined : 'Todavía no cambiaste nada')}
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

export default FilaPago;
