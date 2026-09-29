import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import FichaHeader from './FichaHeader';
import FichaTabs from './FichaTabs';
import { Aviso, useMovimiento } from './piezas';
import { Hueso } from '../huesos/Huesos';
import { leerEstado } from './estadoFicha';
import { ejecutarAccion, ejecutarConsulta, mensajeDeError, obtenerFicha } from './fichaApi';
import TabConfirmacion from './tabs/TabConfirmacion';
import TabFulfillment from './tabs/TabFulfillment';
import TabHistorial from './tabs/TabHistorial';
import TabFormulario from './tabs/TabFormulario';
import TabComunicacion from './tabs/TabComunicacion';
import './ficha.css';

/**
 * Cascarón de la ficha del lead: scrim, cabecera, tablist y UN panel.
 *
 * Un solo modal: las acciones abren sub-vistas dentro del panel, nunca un diálogo
 * encima del diálogo. La pestaña que se abre la decide el backend
 * (`estado.pestana_por_defecto`); acá solo se obedece.
 *
 * `onAccion` es la única vía de escritura de todas las pestañas: ninguna llama
 * `fetch`/`axios` por su cuenta, así que hay un solo lugar donde está escrito qué
 * pasa después de escribir (recargar la ficha y dejar un aviso).
 */

/* `TabResultado` y `TabAcciones` las escribe otro agente en su propio worktree.
   `import.meta.glob` devuelve `{}` cuando no hay coincidencias — con un `import()`
   literal, un archivo ausente rompe el build entero en vez de faltar una pestaña. */
const MODULOS_TAB = import.meta.glob('./tabs/Tab*.jsx');
const cargador = (nombre) => MODULOS_TAB[`./tabs/${nombre}.jsx`] || null;

const MENSAJES = {
    etapa_confirmacion: 'Etapa guardada.',
    como_viene: 'Estado del lead guardado.',
    dolores: 'Dolores guardados.',
    nota_llamada: 'Nota guardada.',
    recordatorio_previo: 'Recordatorio guardado.',
    cerrar_confirmacion: 'Confirmación cerrada: el lead está 100% confirmado.',
    reportar_resultado: 'Resultado reportado.',
    registrar_venta: 'Venta registrada.',
    reprogramar: 'Llamada reprogramada.',
    cancelar: 'Cancelación registrada.',
    descartar: 'Lead descartado.',
    eliminar: 'Lead eliminado.',
    reasignar_closer: 'Lead pasado al closer elegido.',
    guardar_plan: 'Plan de cuotas guardado.',
    guardar_total: 'Total a pagar actualizado: la deuda se recalculó.',
    guardar_programa: 'Programa asignado en las ventas de este cliente.',
    estado_agenda: 'Estado de la agenda corregido.',
    crear_agenda: 'Agenda creada.',
    editar_evento: 'Evento reescrito.',
    borrar_evento: 'Evento borrado del registro.',
    registrar_pago: 'Pago registrado.',
    registrar_seguimiento: 'Seguimiento agendado.',
    dar_de_baja: 'Baja registrada.',
    enviar_nota: 'Nota enviada.',
};

/** Mientras carga se dibuja la forma del modal, no un spinner: no salta el layout. */
const Esqueleto = () => (
    <div style={{ display: 'grid', gap: 'var(--s6)' }} aria-hidden="true">
        <Hueso alto={40} ancho="42%" />
        <Hueso alto={34} paso={1} />
        <div style={{ display: 'grid', gap: 'var(--s4)' }}>
            <Hueso alto={76} paso={2} />
            <Hueso alto={120} paso={3} />
            <Hueso alto={96} paso={4} />
        </div>
    </div>
);

const Faltante = ({ label }) => (
    <div className="vacio-grande">
        <span className="vacio-icono"><AlertTriangle /></span>
        <p className="t-h3">«{label}» todavía no está disponible</p>
        <p className="t-sm mut">
            Esta pestaña se está construyendo en paralelo. El resto de la ficha funciona igual.
        </p>
    </div>
);

const FichaLeadModal = ({
    appointmentId = null,
    clientId = null,
    onCerrar,
    onEditar = null,
    onCambio = null,     // se llama después de cada escritura, para que la tabla de atrás se refresque
    pestanaInicial = null,  // el mazo sabe desde qué columna se abrió; gana sobre la del backend
}) => {
    const [ficha, setFicha] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [pestana, setPestana] = useState(null);
    const mov = useMovimiento();
    const fijada = useRef(false);   // la pestaña por defecto se respeta al abrir, no en cada recarga

    const cargar = useCallback(async (signal) => {
        setCargando(true);
        setError(null);
        try {
            const datos = await obtenerFicha({ appointmentId, clientId, signal });
            setFicha(datos);
            return datos;
        } catch (err) {
            if (err?.code === 'ERR_CANCELED') return null;
            setError(mensajeDeError(err));
            return null;
        } finally {
            setCargando(false);
        }
    }, [appointmentId, clientId]);

    useEffect(() => {
        const ac = new AbortController();
        fijada.current = false;
        setPestana(null);
        cargar(ac.signal);
        return () => ac.abort();
    }, [cargar]);

    const estado = useMemo(() => leerEstado(ficha), [ficha]);

    // Al abrir se obedece `pestana_por_defecto`; después no, o cada guardado
    // devolvería al usuario a la pestaña que el backend considera "donde hay trabajo".
    useEffect(() => {
        if (!ficha || fijada.current) return;
        if (!estado.porDefecto) return;
        // Quien abre la ficha desde una columna del mazo ya dijo a qué venía: el closer que
        // está confirmando no quiere caer en Resultado porque la llamada ya pasó. Solo se
        // respeta si esa pestaña existe para este lead y este rol.
        const pedida = estado.pestanas.some(p => p.id === pestanaInicial) ? pestanaInicial : null;
        setPestana(pedida || estado.porDefecto);
        fijada.current = true;
    }, [ficha, estado.porDefecto, estado.pestanas, pestanaInicial]);

    // Si la pestaña abierta deja de existir tras una recarga (cambió el estado del
    // lead), se cae a la primera visible en vez de quedar en un panel en blanco.
    useEffect(() => {
        if (!pestana || !estado.pestanas.length) return;
        if (!estado.pestanas.some(p => p.id === pestana)) setPestana(estado.pestanas[0].id);
    }, [pestana, estado.pestanas]);

    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onCerrar?.(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onCerrar]);

    // Con el modal abierto la página de atrás no se mueve: el panel lleva su propio scroll.
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    /**
     * `agendaId` apunta la acción a OTRA agenda del mismo cliente. El historial las lista todas y
     * desde ahí hay que poder corregir cualquiera; la ruta ya recibe el id y `permisos_de` lo
     * comprueba contra esa agenda, así que no es un atajo: es la misma puerta con otro número.
     */
    const onAccion = useCallback(async (nombre, payload = {}, agendaId = null) => {
        const appt = agendaId ?? ficha?.identidad?.appointment_id ?? appointmentId;
        setAviso(null);
        try {
            const resultado = await ejecutarAccion(nombre, appt, payload);
            onCambio?.(nombre, resultado);
            // Un lead eliminado no tiene ficha que recargar: se cierra y listo.
            if (nombre === 'eliminar') {
                onCerrar?.();
                return resultado;
            }
            await cargar();
            setAviso({ tono: 'success', texto: MENSAJES[nombre] || 'Guardado.' });
            return resultado;
        } catch (err) {
            setAviso({ tono: 'error', texto: mensajeDeError(err) });
            throw err;
        }
    }, [ficha, appointmentId, cargar, onCambio, onCerrar]);

    // Leer no pasa por `onAccion`: recargar la ficha y dejar un aviso es lo que corresponde
    // después de escribir, no después de traer datos. La pestaña maneja su propia carga.
    const onConsultar = useCallback((nombre, config) => {
        const appt = ficha?.identidad?.appointment_id ?? appointmentId;
        return ejecutarConsulta(nombre, appt, config);
    }, [ficha, appointmentId]);

    const irA = useCallback((id) => setPestana(id), []);
    const onRecargar = useCallback(() => cargar(), [cargar]);

    const TabResultado = useMemo(() => {
        const l = cargador('TabResultado');
        return l ? React.lazy(l) : null;
    }, []);
    const TabAcciones = useMemo(() => {
        const l = cargador('TabAcciones');
        return l ? React.lazy(l) : null;
    }, []);

    const props = { ficha, onAccion, onConsultar, onRecargar, irA, puedeEditar: estado.puedeEditar };

    const panel = () => {
        switch (pestana) {
            case 'conf': return <TabConfirmacion {...props} />;
            case 'resultado': return TabResultado
                ? <Suspense fallback={<Esqueleto />}><TabResultado {...props} /></Suspense>
                : <Faltante label="Resultado" />;
            case 'acciones': return TabAcciones
                ? <Suspense fallback={<Esqueleto />}><TabAcciones {...props} /></Suspense>
                : <Faltante label="Acciones" />;
            case 'ful': return <TabFulfillment {...props} />;
            case 'hist': return <TabHistorial {...props} />;
            case 'form': return <TabFormulario {...props} />;
            case 'com': return <TabComunicacion {...props} />;
            default: return null;
        }
    };

    return (
        <div className="dc-shell scrim"
            onClick={(e) => { if (e.target === e.currentTarget) onCerrar?.(); }}>
            <div className="modal fi-modal" role="dialog" aria-modal="true"
                aria-label={ficha?.identidad?.nombre
                    ? `Ficha de ${ficha.identidad.nombre}`
                    : 'Ficha del lead'}>
                <div className="fi-modal-cab">
                    {cargando && !ficha ? (
                        <div className="fila" style={{ justifyContent: 'space-between' }}>
                            <Hueso alto={36} ancho={280} />
                            <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}>×</button>
                        </div>
                    ) : (
                        <FichaHeader ficha={ficha} onAccion={onAccion} onEditar={onEditar}
                            onCerrar={onCerrar} puedeEditar={estado.puedeEditar} />
                    )}
                </div>

                {/* El tablist espera a la ficha: sin ella `estado.pestanas` es el catálogo
                    entero y se verían seis pestañas que todavía no se sabe si aplican. */}
                {ficha && estado.pestanas.length > 0 && (
                    <FichaTabs pestanas={estado.pestanas} activa={pestana} onCambiar={setPestana}
                        contadores={{ com: ficha.comunicacion?.notas?.length || 0 }} />
                )}

                <div className="fi-modal-panel"
                    id={pestana ? `fi-panel-${pestana}` : undefined}
                    role={pestana ? 'tabpanel' : undefined}
                    aria-labelledby={pestana ? `fi-tab-${pestana}` : undefined}>
                    <div style={{ display: 'grid', gap: 'var(--s3)' }}>
                        {aviso && (
                            <Aviso tono={aviso.tono} titulo={aviso.texto} onCerrar={() => setAviso(null)} />
                        )}
                        {error && !ficha && (
                            <Aviso tono="error" titulo="No se pudo abrir la ficha">{error}</Aviso>
                        )}
                        {/* La `key` es la pestaña: cambiarla remonta el panel y dispara la
                            animación de entrada. Sin `AnimatePresence` a propósito — ver
                            `piezas/movimiento.js`. */}
                        {cargando && !ficha ? <Esqueleto /> : (
                            <motion.div key={pestana || 'vacio'} {...mov.panel}>
                                {panel()}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FichaLeadModal;
