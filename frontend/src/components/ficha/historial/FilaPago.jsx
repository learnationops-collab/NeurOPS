import React, { useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import InlineConfirm from '../../ui/InlineConfirm';
import { diaLegible } from '../piezas/fecha';
import CamposPago, {
    etiquetaDeTipo, faltaParaGuardar, montoExacto, nombreDePrograma,
} from './CamposPago';

/**
 * Una fila de la sección «Pagos» del historial, con su editor en el sitio y su borrado.
 *
 * Pedido del usuario (29/09/2026): «en los pagos también debería ser fácil crear y modificar
 * pagos, sin automatizaciones. Solo es para modificar en caso de haber algún error». El lápiz abre
 * debajo la fecha, el monto, el medio, el programa y el tipo; se guarda con UN pedido
 * (`corregir_pago`) y solo con lo que cambió. La papelera es `InlineConfirm`: pregunta en su
 * lugar y difiere el borrado durante la ventana de «Deshacer», porque una vez que el pedido sale
 * no hay endpoint que devuelva el pago.
 *
 * El backend mueve la venta y su registro en la deuda juntos, y no escribe en Google Sheets ni
 * avisa a nadie: el editor lo dice, porque «sin automatizaciones» es justamente lo que se pidió.
 *
 * La fecha de un pago es un DÍA, no un instante: se lee del texto con `diaLegible` y no se pasa por
 * el huso de quien mira, que solo podría correrla.
 */

const diaDe = (fecha) => (fecha ? String(fecha).slice(0, 10) : '');

const FilaPago = ({
    pago: p, medios = [], programas = [], tipos = [], puedeEditar = false, onCorregir, onBorrar,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const lapiz = useRef(null);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [valores, setValores] = useState({});

    const inicial = {
        fecha: diaDe(p.fecha), monto: p.monto != null ? String(p.monto) : '', medio: p.medio || '',
        programa: p.programa_code || '', tipo: p.tipo || '',
    };
    const dia = diaLegible(p.fecha) || 'Sin fecha';
    const tipo = p.tipo ? etiquetaDeTipo(tipos, p.tipo) : (p.tipo_pago || 'Sin tipo');
    const detalle = [p.programa_code ? nombreDePrograma(programas, p.programa_code) : 'Sin programa',
        p.medio || 'Sin medio'].join(' · ');
    // Cómo lo nombran los lectores de pantalla: «de $300 del 15 sep 2026».
    const cual = `de ${montoExacto(p.monto)} del ${dia}`;

    const abrir = () => {
        setValores(inicial);
        setEditando(true);
    };

    // Al cerrar, el foco vuelve al lápiz: el editor desaparece y, si no, quedaría en el `body`.
    const cerrar = () => {
        setEditando(false);
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
    }
    const hayCambios = Object.keys(cambios).length > 0;
    const falta = editando
        ? faltaParaGuardar(valores, { cambiaTipo: !!cambios.tipo, cambiaFecha: !!cambios.fecha })
        : null;

    const guardar = async () => {
        if (!hayCambios || falta) return;
        setGuardando(true);
        try {
            await onCorregir?.(cambios);
            cerrar();
        } catch {
            // El aviso del cascarón dice por qué; el editor se queda abierto con lo cargado.
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
                </span>
                <span className="fila" style={{ gap: 'var(--s2)', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    <span className="t-sm num" style={{ fontWeight: 600 }}>{montoExacto(p.monto)}</span>
                    {puedeEditar && (
                        <>
                            <button type="button" className="ibtn ibtn--sm" ref={lapiz}
                                aria-expanded={editando}
                                aria-controls={`${ids}-editor`}
                                aria-label={`Corregir el pago ${cual}`}
                                title="Corregir fecha, monto, medio y tipo"
                                onClick={() => (editando ? cerrar() : abrir())}>
                                <Pencil />
                            </button>
                            {/* `alto`/`corner`/`tamIcono` le ponen el uniforme del `.ibtn--sm` de al
                                lado —círculo de 32px con el ícono a 15— para que la fila no termine
                                en un lápiz redondo seguido de un rectángulo. */}
                            <InlineConfirm compacto alto={32} corner={999} tamIcono={15}
                                label="Borrar" title={`Borrar el pago ${cual}`}
                                confirmLabel="Sí, borrar" doneLabel="Borrado"
                                disabled={guardando}
                                onConfirm={() => onBorrar?.()?.catch?.(() => {})} />
                        </>
                    )}
                </span>
            </div>

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
                        onCambiar={(parche) => setValores(v => ({ ...v, ...parche }))}
                        medios={medios} programas={programas} tipos={tipos}
                        actual={{ medio: p.medio, programa: p.programa_code, tipo: p.tipo,
                            tipoCrudo: p.tipo_pago }} />

                    <small className="t-cap mut">
                        Corrige el pago y lo que cuenta la deuda. No escribe en Google Sheets ni le avisa
                        a nadie.
                    </small>

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
