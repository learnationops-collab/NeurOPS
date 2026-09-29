import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { localToday } from '../../../utils/datetime';
import CamposPago, { faltaParaGuardar } from './CamposPago';

/**
 * «Agregar pago», al pie de la sección Pagos del historial.
 *
 * Pedido del usuario (29/09/2026): «en los pagos también debería ser fácil crear y modificar
 * pagos, sin automatizaciones. Solo es para modificar en caso de haber algún error». Los mismos
 * cinco campos que la corrección de una fila (`CamposPago`), todos obligatorios; guarda con
 * `agregar_pago`.
 *
 * No es «Registrar pago» de Acciones, y el formulario lo dice: aquel DECLARA un cobro y dispara
 * todo lo que un cobro implica (el mensaje al cliente, la hoja de Google, las cuotas del plan). Este
 * carga un pago que quedó sin registrar y nada más, que es lo que se pidió.
 *
 * Arranca con hoy, el programa del cliente, el medio de su último pago y «Cuota», que es lo que más
 * se olvida cargar: lo único que hay que escribir casi siempre es el monto.
 */
const AgregarPago = ({
    pagos = [], programaDelCliente = null, medios = [], programas = [], tipos = [], onAgregar,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const boton = useRef(null);
    const devolverFoco = useRef(false);
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [valores, setValores] = useState({});

    // Al cerrar, el foco vuelve al botón que abrió el formulario. Se hace después de dibujarlo:
    // mientras el formulario está abierto el botón no existe.
    useEffect(() => {
        if (abierto || !devolverFoco.current) return;
        devolverFoco.current = false;
        boton.current?.focus();
    }, [abierto]);

    const abrir = () => {
        // El historial manda los pagos del más viejo al más nuevo.
        const ultimo = pagos[pagos.length - 1];
        setValores({
            fecha: localToday(),
            monto: '',
            medio: medios.some(m => m.clave === ultimo?.medio) ? ultimo.medio : (medios[0]?.clave || ''),
            programa: programaDelCliente || ultimo?.programa_code || '',
            tipo: tipos.some(t => t.clave === 'cuota') ? 'cuota' : (tipos[0]?.clave || ''),
        });
        setAbierto(true);
    };

    const cerrar = () => {
        devolverFoco.current = true;
        setAbierto(false);
    };

    const falta = abierto ? faltaParaGuardar(valores, { nuevo: true }) : null;

    const agregar = async () => {
        if (falta) return;
        setGuardando(true);
        try {
            await onAgregar?.({
                fecha: valores.fecha, monto: Number(valores.monto), metodo_pago: valores.medio,
                programa_code: valores.programa, tipo: valores.tipo,
            });
            cerrar();
        } catch {
            // El aviso del cascarón dice por qué; el formulario se queda con lo cargado.
        } finally {
            setGuardando(false);
        }
    };

    if (!abierto) {
        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--s3)' }}>
                <button type="button" ref={boton} className="btn btn--linea btn--sm" onClick={abrir}>
                    Agregar pago
                </button>
            </div>
        );
    }

    return (
        <motion.div className="fi-agenda-editor" role="group" aria-label="Agregar un pago"
            style={{ marginTop: 'var(--s3)', marginBottom: 0 }}
            onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                // Escape cierra el formulario y nada más: el cascarón escucha Escape en `document`
                // para cerrar la ficha entera, con lo que se estuviera cargando.
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
                medios={medios} programas={programas} tipos={tipos} />

            <small className="t-cap mut">
                Carga un pago que quedó sin registrar, y la deuda lo cuenta. No le avisa al cliente, no
                escribe en Google Sheets ni marca cuotas del plan: para cobrar una cuota, «Registrar
                pago» en Acciones.
            </small>

            <div className="fi-agenda-pie">
                <button type="button" className="btn btn--linea" disabled={guardando} onClick={cerrar}>
                    Cancelar
                </button>
                <button type="button" className="btn btn--cta" disabled={guardando || !!falta}
                    title={falta || undefined} onClick={agregar}>
                    {guardando && <span className="ln-spinner" />}
                    Agregar pago
                </button>
            </div>
        </motion.div>
    );
};

export default AgregarPago;
