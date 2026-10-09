import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import FichaHeader from './FichaHeader';
import FichaTabs from './FichaTabs';
import { Aviso, diaLegible, useMovimiento } from './piezas';
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
   literal, un archivo ausente rompe el build entero en vez de faltar una pestaña.

   Los `*.test.jsx` quedan afuera a propósito: `Tab*.jsx` también los agarra, y cada uno
   entraba al build de producción como un chunk propio de ~500 kB con vitest y testing-library
   adentro, que nadie carga nunca. */
const MODULOS_TAB = import.meta.glob(['./tabs/Tab*.jsx', '!./tabs/*.test.jsx']);
const cargador = (nombre) => MODULOS_TAB[`./tabs/${nombre}.jsx`] || null;

/* Los `React.lazy` se crean UNA vez, acá, y no por cada ficha que se abre. Un lazy recién creado
   suspende en su primer render aunque el módulo ya esté cargado, y React 18 no revela el contenido
   de un Suspense hasta ~500 ms después de haber mostrado el fallback: creado dentro del
   componente, cada ficha abierta en Resultado o Acciones mostraba el esqueleto medio segundo. */
const lazyDe = (nombre) => {
    const l = cargador(nombre);
    return l ? React.lazy(l) : null;
};
const TabResultado = lazyDe('TabResultado');
const TabAcciones = lazyDe('TabAcciones');

// Las acciones cuyo editor dice él mismo por qué falló, al lado de su botón (`MotivoDelFallo` en
// los editores en línea del historial). Para ellas el aviso de arriba sería el mismo texto dos
// veces, y encima el de arriba suele quedar fuera de la vista con el historial scrolleado.
// El reporte y la venta de «Resultado» también: la pestaña pinta el error sobre su revisión.
const ERRORES_EN_LINEA = new Set(['editar_agenda', 'corregir_seguimiento', 'agendar_seguimiento',
    'corregir_pago', 'borrar_pago', 'agregar_pago', 'eliminar_agenda', 'borrar_seguimiento',
    'borrar_plan', 'borrar_evento', 'crear_evento', 'reportar_resultado', 'registrar_venta',
    'acceso_academia', 'quitar_acceso_academia', 'guardar_fathom']);

/**
 * El aviso de una acción que dio de baja a un cliente, con lo que pasó con su acceso a la Academia
 * (`acceso_academia`, ver `_con_accesos_de_bajas` en el backend). Si no se pudo cortar vuelve en
 * amarillo y con el motivo: la baja quedó hecha, el acceso hay que quitarlo a mano.
 */
export const conAccesoDeLaBaja = (base, r) => {
    const acceso = r?.acceso_academia;
    if (!acceso) return base;
    if (acceso.estado === 'quitado') return `${base} También se le quitó el acceso a la Academia: vence hoy.`;
    if (acceso.estado === 'sin_cuenta') return `${base} No tenía cuenta en la Academia.`;
    return {
        tono: 'warning',
        texto: `${base} No se le pudo quitar el acceso a la Academia${acceso.motivo ? ` (${acceso.motivo.replace(/\.$/, '')})` : ''}: `
            + 'quitáselo desde Fulfillment.',
    };
};

const MENSAJES = {
    etapa_confirmacion: 'Etapa guardada.',
    como_viene: 'Estado del lead guardado.',
    dolores: 'Dolores guardados.',
    nota_llamada: 'Nota guardada.',
    recordatorio_previo: 'Recordatorio guardado.',
    cerrar_confirmacion: 'Confirmación cerrada: el lead está 100% confirmado.',
    // «No va a pagar» da de baja, y la baja corta el acceso a la Academia: se dice qué pasó.
    reportar_resultado: (r) => conAccesoDeLaBaja('Resultado reportado.', r),
    // La venta del árbol de «Resultado» también da el acceso a la Academia si se pidió: se dice
    // qué pasó con él, porque «se creó la cuenta» significa que al cliente le llegó un email.
    registrar_venta: (r) => {
        if (r?.academia?.creada) return 'Venta registrada. Se le creó la cuenta en la Academia y le llegó un email para activar su contraseña.';
        if (r?.academia) return 'Venta registrada y acceso a la Academia actualizado.';
        return 'Venta registrada.';
    },
    // Fulfillment. Una cuenta nueva le manda al alumno un correo para activar su contraseña.
    acceso_academia: (r) => {
        const hasta = r?.vence ? ` hasta el ${diaLegible(r.vence)}` : '';
        if (r?.accion === 'renovado') return `Acceso a la Academia renovado${hasta}.`;
        return r?.creada
            ? `Acceso a la Academia dado${hasta}. Se le creó la cuenta y le llegó un correo para activar su contraseña.`
            : `Acceso a la Academia dado${hasta}.`;
    },
    // El backend dice si el link es de Fathom (`es_fathom`): uno de otra herramienta se guarda
    // igual, pero el aviso lo dice.
    guardar_fathom: (r) => {
        if (!r?.fathom_url) return 'Link de Fathom quitado.';
        if (r.es_fathom === false) return { tono: 'warning', texto: 'Link guardado, pero no es de Fathom: revisalo.' };
        return 'Link de Fathom guardado: se abre desde la cabecera.';
    },
    quitar_acceso_academia: 'Acceso a la Academia quitado: vence hoy. Se puede renovar cuando haga falta.',
    reprogramar: 'Llamada reprogramada.',
    cancelar: 'Cancelación registrada.',
    descartar: 'Lead descartado.',
    eliminar: 'Lead eliminado.',
    eliminar_agenda: 'Agenda eliminada.',
    borrar_seguimiento: 'Seguimiento eliminado.',
    borrar_plan: 'Plan de cuotas eliminado.',
    crear_evento: 'Evento agregado.',
    reasignar_closer: 'Lead pasado al closer elegido.',
    // El backend devuelve `cambios` vacío cuando lo escrito, ya normalizado, es lo que había
    // (un 'no tengo' sobre un instagram vacío, un 'n/a' sobre un correo vacío): no se guardó nada.
    editar_datos: (r) => (r?.cambios && !Object.keys(r.cambios).length
        ? 'No había nada que corregir: los datos ya estaban así.'
        : 'Datos del lead corregidos.'),
    guardar_plan: 'Plan de cuotas guardado.',
    guardar_total: 'Total a pagar actualizado: la deuda se recalculó.',
    guardar_programa: 'Programa asignado en las ventas de este cliente.',
    estado_agenda: 'Estado de la agenda corregido.',
    crear_agenda: 'Agenda creada.',
    editar_agenda: 'Agenda corregida.',
    agendar_seguimiento: 'Seguimiento agendado.',
    corregir_seguimiento: 'Seguimiento corregido.',
    editar_evento: 'Evento reescrito.',
    borrar_evento: 'Evento borrado del registro.',
    registrar_pago: 'Pago registrado.',
    // Un pago corregido mueve también la deuda... cuando el backend encuentra su registro en
    // inscripciones (`espejo`). Si no lo encuentra corrige solo la venta, y decir «la deuda se
    // recalculó» sería mentirle a quien está mirando un «Debe» que no se movió.
    agregar_pago: (r) => (r?.espejo === false
        ? 'Pago agregado, pero sin registro en inscripciones: la deuda no lo cuenta.'
        : 'Pago agregado: la deuda ya lo cuenta.'),
    // Marcar a quién se le hizo una transferencia no toca la plata: la deuda no se movió.
    corregir_pago: (r) => (r?.cambios?.length === 1 && r.cambios[0] === 'transferido_a'
        ? 'Listo: quedó anotado a quién se le hizo la transferencia.'
        : r?.espejo === false
            ? 'Pago corregido. No se encontró su registro en inscripciones, así que la deuda no cambió.'
            : 'Pago corregido: la deuda se recalculó.'),
    borrar_pago: (r) => (r?.espejo === false
        ? 'Pago borrado. No tenía registro en inscripciones: la deuda no cambió.'
        : 'Pago borrado: la deuda se recalculó.'),
    registrar_seguimiento: 'Seguimiento agendado.',
    dar_de_baja: (r) => conAccesoDeLaBaja(
        'Baja registrada: ya no debe nada y sale de las listas de cobro. Lo que pagó queda.', r),
    // El monto viene del backend, ya recalculado: es la deuda que vuelve.
    revertir_baja: (r) => (Number(r?.deuda) > 0.009
        ? `Baja revertida: vuelve a deber $${Number(r.deuda).toLocaleString('es-AR', { maximumFractionDigits: 2 })} y vuelve a las listas de cobro.`
        : 'Baja revertida: vuelve a las listas de cobro.')
        + ' El acceso a la Academia no vuelve solo: renovalo desde Fulfillment si lo necesita.',
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
    onCambio = null,     // se llama después de cada escritura, para que la tabla de atrás se refresque
    pestanaInicial = null,  // el mazo sabe desde qué columna se abrió; gana sobre la del backend
    abrirEnVenta = false,   // «Declarar venta» del dock: Resultado arranca en «Registrar una venta»
    seguimiento = null,     // 'contacto' | 'cobro': se abrió para reportar ese seguimiento
    seccionInicial = null,  // 'pagos': el Historial arranca con esa sección abierta (Finanzas › Diferencias)
}) => {
    const [ficha, setFicha] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);
    // Se vende una vez: con la venta ya registrada, volver a Resultado no arranca otra.
    const [venderAlAbrir, setVenderAlAbrir] = useState(abrirEnVenta);
    // Igual con el seguimiento: una vez reportado, Resultado vuelve a leer el de la agenda.
    const [seguimientoPedido, setSeguimientoPedido] = useState(seguimiento);
    const [pestana, setPestana] = useState(null);
    const mov = useMovimiento();
    const fijada = useRef(false);   // la pestaña por defecto se respeta al abrir, no en cada recarga
    // La agenda en la que quedó anclada la ficha cuando se borró aquella con la que se abrió (ver
    // `eliminar_agenda`). Es una ref y no estado a propósito: cambiarla no tiene que volver a
    // correr el efecto de apertura, que resetea la pestaña y sacaría a la persona del Historial.
    const ancla = useRef(null);
    // El número del último pedido de la ficha. Solo ESE pedido escribe la ficha, el error y el fin
    // de la carga: uno abortado (StrictMode monta el efecto dos veces; cambiar de lead aborta el
    // anterior) terminaba DESPUÉS de que arrancara el nuevo y apagaba `cargando` con la ficha
    // todavía en camino. La cabecera se pintaba sin ficha, con el lápiz, y el editor abría vacío.
    const ultimoPedido = useRef(0);

    const cargar = useCallback(async (signal) => {
        const pedido = ++ultimoPedido.current;
        const vigente = () => pedido === ultimoPedido.current;
        setCargando(true);
        setError(null);
        try {
            const datos = await obtenerFicha({
                appointmentId: ancla.current ?? appointmentId, clientId, signal,
            });
            // Una recarga que llega después de otra más nueva traería datos viejos.
            if (!vigente()) return null;
            setFicha(datos);
            return datos;
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || !vigente()) return null;
            setError(mensajeDeError(err));
            return null;
        } finally {
            if (vigente()) setCargando(false);
        }
    }, [appointmentId, clientId]);

    useEffect(() => {
        const ac = new AbortController();
        fijada.current = false;
        ancla.current = null;   // otro lead: el ancla del anterior no aplica
        setPestana(null);
        // Ni la ficha del lead anterior: mientras llega la nueva se veía la vieja, y un editor
        // abierto en ella guardaba lo tipeado sobre el lead nuevo apenas este llegaba.
        setFicha(null);
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
            if (nombre === 'registrar_venta') setVenderAlAbrir(false);
            if (nombre === 'registrar_venta' || nombre === 'reportar_resultado') setSeguimientoPedido(null);
            // Un lead eliminado no tiene ficha que recargar: se cierra y listo.
            if (nombre === 'eliminar') {
                onCerrar?.();
                return resultado;
            }
            // Borrar desde el historial la agenda con la que está abierta la ficha: se sigue en la
            // que le queda al cliente, y si no le queda ninguna, el lead ya no tiene ficha.
            if (nombre === 'eliminar_agenda' && appt === ficha?.identidad?.appointment_id) {
                if (!resultado?.agenda_siguiente) {
                    onCerrar?.();
                    return resultado;
                }
                ancla.current = resultado.agenda_siguiente;
            }
            await cargar();
            // Un mensaje puede depender de lo que respondió el backend (ver `editar_datos` y
            // `corregir_pago`).
            const mensaje = MENSAJES[nombre];
            const aviso = typeof mensaje === 'function' ? mensaje(resultado) : mensaje;
            // Un mensaje puede traer su propio tono (`{tono, texto}`): la acción salió, pero algo
            // de lo que venía con ella no (ver `conAccesoDeLaBaja`).
            setAviso(aviso && typeof aviso === 'object'
                ? { tono: aviso.tono || 'success', texto: aviso.texto }
                : { tono: 'success', texto: aviso || 'Guardado.' });
            return resultado;
        } catch (err) {
            // Si el backend dice QUÉ campo falló, el error ya se pinta al lado de ese campo (el
            // editor de la cabecera lo hace), y los editores del historial dicen el suyo junto a
            // su botón: repetirlo en la franja de arriba era el mismo párrafo dos veces.
            if (!err?.response?.data?.campo && !ERRORES_EN_LINEA.has(nombre)) {
                setAviso({ tono: 'error', texto: mensajeDeError(err) });
            }
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

    const props = { ficha, onAccion, onConsultar, onRecargar, irA, puedeEditar: estado.puedeEditar };

    const panel = () => {
        switch (pestana) {
            case 'conf': return <TabConfirmacion {...props} />;
            case 'resultado': return TabResultado
                ? <Suspense fallback={<Esqueleto />}><TabResultado {...props} arrancarEnVenta={venderAlAbrir} seguimientoPedido={seguimientoPedido} /></Suspense>
                : <Faltante label="Resultado" />;
            case 'acciones': return TabAcciones
                ? <Suspense fallback={<Esqueleto />}><TabAcciones {...props} /></Suspense>
                : <Faltante label="Acciones" />;
            case 'ful': return <TabFulfillment {...props} />;
            case 'hist': return <TabHistorial {...props} seccionAbierta={seccionInicial} />;
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
                        <FichaHeader ficha={ficha} onAccion={onAccion}
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
