import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarX, CheckCircle2, Trash2, UserX } from 'lucide-react';
import { Aviso, StepperFicha, TarjetaAccion, useMovimiento } from '../piezas';
import SubReprogramar from './confirmacion/SubReprogramar';
import SubCancelo from './confirmacion/SubCancelo';
import SubDescalificar from './confirmacion/SubDescalificar';
import SubEliminar from './confirmacion/SubEliminar';
import './confirmacion/reprogramar.css';

/**
 * Pestaña de confirmación (precall).
 *
 * Es el reemplazo del paso `modalStep === 'confirm'` del mazo del closer: etapa
 * y la nota para la llamada.
 *
 * «Cómo viene» se sacó de acá (23/10/2026): la etapa ya dice cómo viene. La columna
 * sigue en la base con lo que ya se cargó.
 *
 * El recordatorio previo se quitó a pedido del equipo (28/09/2026). El campo sigue en
 * la base y en el endpoint: lo que se fue es el control, no el dato.
 *
 * Las etapas y los vocabularios llegan del servidor: hoy viven hardcodeados en
 * `CloserWorkflowPage.jsx` y por eso el mazo y el libro de la dirección muestran
 * listas distintas del mismo campo.
 */
const TabConfirmacion = ({ ficha, onAccion, irA, puedeEditar = true }) => {
    const [modo, setModo] = useState('menu');
    const mov = useMovimiento();
    const [guardando, setGuardando] = useState(false);
    const conf = ficha?.confirmacion || {};
    const cerrada = !!conf.cerrada;
    // Un lead confirmado se sigue pudiendo editar: la nota, las acciones y volver a una etapa
    // anterior si se marcó por error o pasó algo después.
    const bloqueado = !puedeEditar || ficha?.permisos?.confirmar === false;

    const etapas = ficha?.vocabulario?.etapas_confirmacion || [];
    const indice = Math.max(0, etapas.findIndex(e => e.clave === conf.etapa));
    const ultima = etapas.length ? etapas[etapas.length - 1] : null;
    // Se puede confirmar desde Contactado: la última etapa es Confirmado misma.
    const listaParaCerrar = etapas.length > 0 && indice >= etapas.length - 2;

    // La nota se edita en local y se guarda al salir del campo: un PATCH por tecla
    // sería una petición cada 200 ms mientras se escribe.
    const [nota, setNota] = useState(conf.nota || '');
    useEffect(() => { setNota(conf.nota || ''); }, [ficha?.identidad?.appointment_id, conf.nota]);

    const pasos = useMemo(() => etapas.map((e, i) => ({
        key: e.clave,
        label: e.label,
        estado: cerrada || i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente',
    })), [etapas, indice, cerrada]);

    // Tres etapas (Por contactar · Contactado · Confirmado, 23/10/2026): tocar la última es
    // «Listo · 100% confirmado», que es lo único que escribe Confirmado en la cita. Ya
    // confirmado, tocar una anterior lo vuelve a esa etapa (`cerrada: false`).
    const tocarEtapa = (clave) => {
        if (ultima && clave === ultima.clave) {
            if (!cerrada) correr('cerrar_confirmacion', {});
            return;
        }
        disparar('etapa_confirmacion', cerrada ? { etapa: clave, cerrada: false } : { etapa: clave });
    };

    /* Guardado al vuelo (stepper, desplegables, nota): el cascarón ya muestra el error
       en un aviso, pero relanza para que las sub-vistas puedan reaccionar. Acá no hay
       nada que reaccione, así que se traga la promesa — sin esto queda un rechazo sin
       manejar cada vez que el backend dice no. */
    const disparar = (nombre, payload) => { onAccion(nombre, payload).catch(() => {}); };

    const correr = async (nombre, payload) => {
        setGuardando(true);
        try {
            await onAccion(nombre, payload);
            setModo('menu');
        } catch {
            // El aviso de error lo pone el cascarón; la sub-vista se queda abierta con
            // lo que el usuario cargó para que pueda corregirlo sin volver a escribirlo.
        } finally {
            setGuardando(false);
        }
    };

    if (modo !== 'menu') {
        const volver = () => setModo('menu');
        return (
            <motion.div key={modo} {...mov.subvista}>
                {modo === 'repro' && (
                    <SubReprogramar ficha={ficha} guardando={guardando} onVolver={volver}
                        onConfirmar={(p) => correr('reprogramar', p)} />
                )}
                {modo === 'cancelo' && (
                    <SubCancelo ficha={ficha} guardando={guardando} onVolver={volver}
                        onConfirmar={(p) => correr('cancelar', p)} />
                )}
                {modo === 'descal' && (
                    <SubDescalificar ficha={ficha} guardando={guardando} onVolver={volver}
                        onConfirmar={(p) => correr('descalificar', p)} />
                )}
                {modo === 'elim' && (
                    <SubEliminar ficha={ficha} onVolver={volver}
                        onConfirmar={() => onAccion('eliminar', {}).catch(() => {})} />
                )}
            </motion.div>
        );
    }

    return (
        <motion.div key="menu" style={{ display: 'grid', gap: 'var(--s5)' }} {...mov.subvista}>
            {cerrada && (
                <Aviso tono="success" titulo="Lead 100% confirmado">
                    Queda listo para el día de la llamada.
                </Aviso>
            )}

            <StepperFicha
                rotulo="Etapa de confirmación"
                ayuda={cerrada ? 'Confirmación completa · tocá otra etapa para volver' : 'Tocá la etapa a la que llegó · se guarda solo'}
                pasos={pasos}
                deshabilitado={bloqueado || guardando}
                onPaso={bloqueado ? null : tocarEtapa} />

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor="fi-nota">Nota para la llamada (opcional)</label>
                <textarea id="fi-nota" className="area" rows={3} value={nota} disabled={bloqueado}
                    style={{ minHeight: 104 }}
                    placeholder="Ej: pidió que lo llamemos después de las 20 h. Trabaja de guardia."
                    onChange={(e) => setNota(e.target.value)}
                    onBlur={() => { if (!bloqueado && nota !== (conf.nota || '')) disparar('nota_llamada', { nota }); }} />
            </div>

            {/* Jerarquía (25/11/2026): el CTA «Listo · 100% confirmado» manda en el pie; lo que cambió
                con la llamada va arriba en tres tarjetas iguales con su explicación, y eliminar queda
                aparte y chico, que es lo raro y lo que no tiene vuelta. */}
            <div className="cf-cambio">
                <div className="cf-cambio-cab">
                    <small className="t-rotulo">¿Cambió algo con la llamada?</small>
                    <button type="button" className="cf-eliminar"
                        disabled={!puedeEditar || ficha?.permisos?.eliminar === false}
                        onClick={() => setModo('elim')}>
                        <Trash2 size={13} /> Eliminar lead
                    </button>
                </div>
                <div className="cf-cambio-grid">
                    <TarjetaAccion tono="info" icono={Calendar} label="Reprogramar" detalle="Otro día, otra hora u otra persona"
                        deshabilitado={bloqueado} onClick={() => setModo('repro')} />
                    <TarjetaAccion tono="warning" icono={CalendarX} label="Canceló" detalle="No se hace, pero el lead sigue vivo"
                        deshabilitado={bloqueado} onClick={() => setModo('cancelo')} />
                    {/* Reemplaza al «Descartar lead», que marcaba «No Lead»: es lo mismo (23/10/2026). */}
                    <TarjetaAccion tono="error" icono={UserX} label="Descalificado" detalle="No califica: se cancela la llamada"
                        deshabilitado={bloqueado || ficha?.permisos?.reportar === false}
                        onClick={() => setModo('descal')} />
                </div>
            </div>

            <div className="fi-pie">
                {cerrada ? (
                    <>
                        <span />
                        <button type="button" className="btn btn--linea" disabled={guardando}
                            onClick={() => correr('etapa_confirmacion', { cerrada: false })}>
                            Deshacer
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className="btn btn--linea" onClick={() => irA?.('hist')}>
                            Seguir después
                        </button>
                        <button type="button" className="btn btn--cta cf-cta"
                            disabled={bloqueado || !listaParaCerrar || guardando}
                            title={!listaParaCerrar ? 'Primero marcá que lo contactaste' : undefined}
                            onClick={() => correr('cerrar_confirmacion', {})}>
                            <CheckCircle2 size={16} />
                            Listo · 100% confirmado
                        </button>
                    </>
                )}
            </div>

            {/* La hora ya pasó y el lead nunca confirmó: esa hora no puede pasar en
                silencio. No se reporta desde acá — el árbol de resultado vive en su
                pestaña y duplicarlo sería duplicar el inventario de campos. */}
            {!cerrada && ficha?.estado?.clave === 'vencida_sin_reportar' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => irA?.('resultado')}>
                        Hora ya pasó · reportar qué pasó
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default TabConfirmacion;
