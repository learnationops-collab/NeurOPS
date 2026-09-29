import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Aviso from '../piezas/Aviso';
import { diaLegible, instanteLegible } from '../piezas/fecha';
import { localDateFromNow, localToday } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import Desplegable from './Desplegable';
import { estadoDeSeguimiento } from './FilaSeguimiento';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * «Agendar seguimiento», al pie de la sección Seguimientos del historial.
 *
 * Pedido del usuario (29/09/2026): «En los seguimientos deberían poder crearse seguimientos...».
 * Día, tipo y nota; y, si el cliente tiene más de una agenda, sobre cuál (por defecto la más
 * reciente). Guarda con `agendar_seguimiento`, apuntado a la agenda elegida.
 *
 * Un seguimiento vive en su agenda y hay UNO por agenda: agendar sobre una que ya tiene uno lo
 * REEMPLAZA. El formulario lo dice antes de guardar, con el seguimiento que se va a pisar, y el
 * botón cambia a «Reemplazar seguimiento»: que se entere después, mirando la lista, sería perder
 * un dato sin haberlo decidido.
 *
 * Debajo de los campos dice a quién le va a aparecer: el seguimiento lo ve el closer DUEÑO de la
 * agenda en su pestaña Seguimientos, desde el día elegido. Es lo que el formulario no puede
 * mostrar de otra forma, y lo que hace que la dirección no agende para un closer dado de baja sin
 * saberlo.
 */

const tipoPorDefecto = (tipos, agenda) => (
    tipos.some(t => t.clave === agenda?.tipo_seguimiento) ? agenda.tipo_seguimiento : tipos[0]?.clave
) || '';

const AgendarSeguimiento = ({ agendas = [], seguimientos = [], tipos = [], closers = [], onAgendar }) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const boton = useRef(null);
    const devolverFoco = useRef(false);
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [agendaId, setAgendaId] = useState('');
    const [dia, setDia] = useState('');
    const [tipo, setTipo] = useState('');
    const [tipoElegido, setTipoElegido] = useState(false);
    const [nota, setNota] = useState('');
    const [error, setError] = useState(null);

    // Al cerrar, el foco vuelve al botón que abrió el formulario. Se hace después de dibujarlo:
    // mientras el formulario está abierto el botón no existe.
    useEffect(() => {
        if (abierto || !devolverFoco.current) return;
        devolverFoco.current = false;
        boton.current?.focus();
    }, [abierto]);

    if (!agendas.length) return null;

    const agenda = agendas.find(a => String(a.id) === agendaId) || agendas[0];
    const existente = seguimientos.find(s => String(s.agenda_id) === String(agenda.id));
    // Un closer que no está en la lista de activos no ve su pestaña: nadie vería el seguimiento.
    const closerInactivo = agenda.closer_id != null && closers.length > 0
        && !closers.some(c => String(c.id) === String(agenda.closer_id));
    const pasado = dia && dia < localToday();

    const abrir = () => {
        // La más reciente: el historial manda las agendas de la última a la primera.
        setAgendaId(String(agendas[0].id));
        // A los tres días, que es el segundo paso de la cadencia de seguimiento.
        setDia(localDateFromNow(3));
        setTipo(tipoPorDefecto(tipos, agendas[0]));
        setTipoElegido(false);
        setNota('');
        setError(null);
        setAbierto(true);
    };

    const cerrar = () => {
        devolverFoco.current = true;
        setAbierto(false);
    };

    // Cambiar un campo borra el motivo del intento anterior: ya habla de otros datos.
    const cambiarCon = (set) => (valor) => {
        setError(null);
        set(valor);
    };

    const elegirAgenda = (id) => {
        setError(null);
        setAgendaId(id);
        // El tipo sigue a la agenda mientras nadie lo haya elegido a mano: un no show pide
        // recuperación y una llamada que asistió, seguimiento de la decisión.
        if (!tipoElegido) setTipo(tipoPorDefecto(tipos, agendas.find(a => String(a.id) === id)));
    };

    const agendar = async () => {
        setGuardando(true);
        setError(null);
        try {
            // El segundo argumento apunta la acción a la agenda ELEGIDA, no a la que abrió la ficha.
            await onAgendar?.({ fecha: dia, tipo, nota: nota.trim() }, agenda.id);
            cerrar();
        } catch (err) {
            // El formulario se queda con lo cargado y dice por qué, al lado del botón: el aviso
            // del cascarón queda arriba del panel, fuera de la vista.
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    if (!abierto) {
        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--s3)' }}>
                <button type="button" ref={boton} className="btn btn--linea btn--sm" onClick={abrir}>
                    Agendar seguimiento
                </button>
            </div>
        );
    }

    return (
        <motion.div className="fi-agenda-editor" role="group" aria-label="Agendar un seguimiento"
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
            <div className="fi-agenda-campos">
                {agendas.length > 1 && (
                    <div className="fi-campo">
                        <label className="t-rotulo" htmlFor={`${ids}-agenda`}>Sobre la agenda</label>
                        <Desplegable id={`${ids}-agenda`} etiqueta="Agenda del seguimiento"
                            valor={String(agenda.id)} disabled={guardando} onCambiar={elegirAgenda}>
                            {agendas.map(a => (
                                <option key={a.id} value={String(a.id)}>
                                    {[instanteLegible(a.fecha) || 'Sin fecha', a.chip?.label, a.closer,
                                        seguimientos.some(s => String(s.agenda_id) === String(a.id))
                                            ? 'ya tiene seguimiento' : null]
                                        .filter(Boolean).join(' · ')}
                                </option>
                            ))}
                        </Desplegable>
                    </div>
                )}

                <div className="fi-campo">
                    <label className="t-rotulo" htmlFor={`${ids}-dia`}>Día del contacto</label>
                    <span className="ln-field" style={{ height: 44 }}>
                        <input id={`${ids}-dia`} type="date" value={dia} required autoFocus
                            disabled={guardando} onChange={(e) => cambiarCon(setDia)(e.target.value)} />
                    </span>
                </div>

                <div className="fi-campo">
                    <label className="t-rotulo" htmlFor={`${ids}-tipo`}>Tipo</label>
                    <Desplegable id={`${ids}-tipo`} etiqueta="Tipo de seguimiento" valor={tipo}
                        disabled={guardando}
                        onCambiar={(v) => { cambiarCon(setTipo)(v); setTipoElegido(true); }}>
                        {tipos.map(t => <option key={t.clave} value={t.clave}>{t.label}</option>)}
                    </Desplegable>
                    {tipos.find(t => t.clave === tipo)?.desc && (
                        <small className="t-cap mut">{tipos.find(t => t.clave === tipo).desc}</small>
                    )}
                </div>

                <div className="fi-campo" style={{ gridColumn: '1 / -1' }}>
                    <label className="t-rotulo" htmlFor={`${ids}-nota`}>Nota</label>
                    <span className="ln-field" style={{ height: 44 }}>
                        <input id={`${ids}-nota`} value={nota} maxLength={255} disabled={guardando}
                            placeholder="Qué hay que hacer (opcional)"
                            onChange={(e) => cambiarCon(setNota)(e.target.value)} />
                    </span>
                </div>
            </div>

            {existente && (
                <Aviso tono="warning" titulo="Esta agenda ya tiene un seguimiento: agendar este lo reemplaza">
                    {[estadoDeSeguimiento(existente).label, diaLegible(existente.fecha) || 'sin fecha',
                        existente.nota ? `«${existente.nota}»` : null].filter(Boolean).join(' · ')}
                    . Cada agenda guarda uno solo; el que se reemplaza queda en el registro de eventos.
                </Aviso>
            )}

            <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                {closerInactivo ? (
                    <small className="t-cap" style={{ color: 'var(--warning)' }}>
                        {agenda.closer || 'El closer de esa agenda'} ya no está activo: ningún closer lo va a
                        ver en su pestaña Seguimientos hasta que le cambies el closer a la agenda.
                    </small>
                ) : agenda.closer && (
                    <small className="t-cap mut">
                        Le va a aparecer a {agenda.closer} en su pestaña Seguimientos
                        {dia ? ` desde el ${diaLegible(dia)}` : ''}.
                    </small>
                )}
                {pasado && (
                    <small className="t-cap" style={{ color: 'var(--warning)' }}>
                        Ese día ya pasó: el seguimiento entra como atrasado.
                    </small>
                )}
            </div>

            <MotivoDelFallo motivo={error} />

            <div className="fi-agenda-pie">
                <button type="button" className="btn btn--linea" disabled={guardando} onClick={cerrar}>
                    Cancelar
                </button>
                <button type="button" className="btn btn--cta" disabled={guardando || !dia || !tipo}
                    onClick={agendar}>
                    {guardando && <span className="ln-spinner" />}
                    {existente ? 'Reemplazar seguimiento' : 'Agendar seguimiento'}
                </button>
            </div>
        </motion.div>
    );
};

export default AgendarSeguimiento;
