import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { Aviso, DesplegableAgrupado, StepperFicha, TarjetaAccion } from '../piezas';
import { grupos } from '../estadoFicha';
import SubReprogramar from './confirmacion/SubReprogramar';
import SubDescartar from './confirmacion/SubDescartar';
import SubEliminar from './confirmacion/SubEliminar';

/**
 * Pestaña de confirmación (precall).
 *
 * Es el reemplazo del paso `modalStep === 'confirm'` del mazo del closer y conserva
 * TODO lo que ese paso recolectaba: etapa, «cómo viene», dolores, el recordatorio
 * previo a la llamada y la nota. Simplificar era dejar de mostrar lo que no hace
 * falta, no dejar de guardar.
 *
 * Las etapas y los vocabularios llegan del servidor: hoy viven hardcodeados en
 * `CloserWorkflowPage.jsx` y por eso el mazo y el libro de la dirección muestran
 * listas distintas del mismo campo.
 */
const TabConfirmacion = ({ ficha, onAccion, irA, puedeEditar = true }) => {
    const [modo, setModo] = useState('menu');
    const [guardando, setGuardando] = useState(false);
    const conf = ficha?.confirmacion || {};
    const cerrada = !!conf.cerrada;
    const bloqueado = !puedeEditar || ficha?.permisos?.confirmar === false || cerrada;

    const etapas = ficha?.vocabulario?.etapas_confirmacion || [];
    const indice = Math.max(0, etapas.findIndex(e => e.clave === conf.etapa));
    const ultima = etapas.length ? etapas[etapas.length - 1] : null;
    const enLaUltima = etapas.length > 0 && indice === etapas.length - 1;

    // La nota se edita en local y se guarda al salir del campo: un PATCH por tecla
    // sería una petición cada 200 ms mientras se escribe.
    const [nota, setNota] = useState(conf.nota || '');
    useEffect(() => { setNota(conf.nota || ''); }, [ficha?.identidad?.appointment_id, conf.nota]);

    const recordatorio = conf.recordatorio_previo || {};
    const [avisoActivo, setAvisoActivo] = useState(!!recordatorio.activo);
    const [avisoCuando, setAvisoCuando] = useState(recordatorio.cuando || '');
    useEffect(() => {
        setAvisoActivo(!!conf.recordatorio_previo?.activo);
        setAvisoCuando(conf.recordatorio_previo?.cuando || '');
    }, [ficha?.identidad?.appointment_id, conf.recordatorio_previo?.activo, conf.recordatorio_previo?.cuando]);

    const pasos = useMemo(() => etapas.map((e, i) => ({
        key: e.clave,
        label: e.label,
        estado: cerrada || i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente',
    })), [etapas, indice, cerrada]);

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

    if (modo === 'repro') {
        return <SubReprogramar ficha={ficha} guardando={guardando}
            onVolver={() => setModo('menu')}
            onConfirmar={(p) => correr('reprogramar', p)} />;
    }
    if (modo === 'desc') {
        return <SubDescartar ficha={ficha} guardando={guardando}
            onVolver={() => setModo('menu')}
            onConfirmar={(p) => correr('descartar', p)} />;
    }
    if (modo === 'elim') {
        return <SubEliminar ficha={ficha}
            onVolver={() => setModo('menu')}
            onConfirmar={() => onAccion('eliminar', {}).catch(() => {})} />;
    }

    return (
        <div style={{ display: 'grid', gap: 'var(--s6)' }}>
            {cerrada && (
                <Aviso tono="success" titulo="Lead 100% confirmado">
                    Queda listo para el día de la llamada.
                </Aviso>
            )}

            <StepperFicha
                rotulo="Etapa de confirmación"
                ayuda={cerrada ? 'Confirmación completa' : 'Tocá la etapa a la que llegó · se guarda solo'}
                pasos={pasos}
                deshabilitado={bloqueado || guardando}
                onPaso={bloqueado ? null : (clave) => disparar('etapa_confirmacion', { etapa: clave })} />

            <div className="grid-2">
                <DesplegableAgrupado
                    rotulo="Cómo viene"
                    ayuda="Se pone solo · cambialo si hace falta"
                    etiqueta="Cómo viene"
                    placeholder="Elegí cómo viene"
                    grupos={grupos(ficha, 'como_viene')}
                    valor={conf.como_viene ?? null}
                    deshabilitado={bloqueado}
                    onChange={(v) => disparar('como_viene', { como_viene: v })}
                    onAgregar={({ label }) => disparar('como_viene', { como_viene: label, nueva_opcion: label })} />

                {/* Los dolores venían del mazo del closer como chips sueltos: acá entran
                    al mismo desplegable agrupado que «Cómo viene» y además aceptan
                    opciones nuevas, que antes no se podían crear. */}
                <DesplegableAgrupado
                    rotulo="Dolores que contó"
                    ayuda="Elegí todos los que aparezcan"
                    etiqueta="Dolores que contó"
                    placeholder="Elegí los dolores"
                    multiple
                    alinear="der"
                    grupos={grupos(ficha, 'dolores')}
                    valor={conf.dolores || []}
                    deshabilitado={bloqueado}
                    onChange={(v) => disparar('dolores', { dolores: v })}
                    onAgregar={({ label }) => disparar('dolores', { dolores: [...(conf.dolores || []), label], nueva_opcion: label })} />
            </div>

            {/* El recordatorio previo solo aplica antes del primer contacto: después de
                contactar, lo que hace falta es la nota, no un aviso para escribirle. */}
            {!cerrada && indice === 0 && (
                <div className="hundido" style={{ display: 'grid', gap: 'var(--s2)', padding: 'var(--s4)' }}>
                    <label className="fila" style={{ gap: 'var(--s2)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={avisoActivo} disabled={bloqueado}
                            style={{ width: 16, height: 16, accentColor: 'var(--brand-secondary)' }}
                            onChange={(e) => {
                                setAvisoActivo(e.target.checked);
                                disparar('recordatorio_previo', {
                                    recordatorio_previo: { activo: e.target.checked, cuando: avisoCuando || null },
                                });
                            }} />
                        <small className="t-rotulo">Recordarme escribirle antes de la llamada</small>
                    </label>
                    {avisoActivo && (
                        <div className="campo">
                            <input type="datetime-local" value={avisoCuando} disabled={bloqueado}
                                aria-label="Cuándo recordarme"
                                onChange={(e) => setAvisoCuando(e.target.value)}
                                onBlur={() => disparar('recordatorio_previo', {
                                    recordatorio_previo: { activo: true, cuando: avisoCuando || null },
                                })} />
                        </div>
                    )}
                </div>
            )}

            <div className="fi-campo">
                <label className="t-rotulo" htmlFor="fi-nota">Nota para la llamada (opcional)</label>
                <textarea id="fi-nota" className="area" rows={3} value={nota} disabled={bloqueado}
                    style={{ minHeight: 104 }}
                    placeholder="Ej: pidió que lo llamemos después de las 20 h. Trabaja de guardia."
                    onChange={(e) => setNota(e.target.value)}
                    onBlur={() => { if (!bloqueado && nota !== (conf.nota || '')) disparar('nota_llamada', { nota }); }} />
            </div>

            <div className="fi-pie">
                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                    <TarjetaAccion linea tono="info" icono={Calendar} label="Reprogramar"
                        deshabilitado={bloqueado} onClick={() => setModo('repro')} />
                    <TarjetaAccion linea tono="warning" icono={XCircle} label="Descartar lead"
                        deshabilitado={bloqueado} onClick={() => setModo('desc')} />
                    <TarjetaAccion linea tono="error" icono={Trash2} label="Eliminar lead"
                        deshabilitado={!puedeEditar || ficha?.permisos?.eliminar === false}
                        onClick={() => setModo('elim')} />
                </div>
                <div className="fi-pie-der">
                    {!cerrada && !enLaUltima && ultima && (
                        <span className="t-cap mut">Falta marcar hasta {ultima.label}</span>
                    )}
                    {cerrada ? (
                        <button type="button" className="btn btn--linea" disabled={guardando}
                            onClick={() => correr('etapa_confirmacion', { cerrada: false })}>
                            Deshacer
                        </button>
                    ) : (
                        <>
                            <button type="button" className="btn btn--linea" onClick={() => irA?.('hist')}>
                                Seguir después
                            </button>
                            <button type="button" className="btn btn--cta"
                                disabled={bloqueado || !enLaUltima || guardando}
                                onClick={() => correr('cerrar_confirmacion', {})}>
                                <CheckCircle2 size={14} />
                                Listo · 100% confirmado
                            </button>
                        </>
                    )}
                </div>
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
        </div>
    );
};

export default TabConfirmacion;
