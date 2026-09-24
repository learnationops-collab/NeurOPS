import React, { useEffect, useState } from 'react';
import { Calendar, Check, CheckCircle2, Clock, Inbox, Mail, Pencil, Phone, Target, X } from 'lucide-react';
import { ChipTono } from './Revisar';
import { fmt } from './Shared';

/**
 * Modal del lead: el detalle de una fila SIN salir de Revisar (no navega, se abre encima).
 *
 * Trae el recorrido del lead (6 pasos), los datos de contacto y el bloque para corregir el
 * estado. Corregir dispara `onCorregir`, que hace el PATCH y vuelve a pedir la tabla y el
 * resumen: el requisito es que la tabla, el filtro rápido, los totales y los KPIs se recalculen
 * sin recargar.
 */

const PASOS = [
    { key: 'llego', label: 'Llegó', Icono: Inbox },
    { key: 'contacto', label: 'Contactó', Icono: Check },
    { key: 'dolor', label: 'Dolor', Icono: Target },
    { key: 'agenda', label: 'Agenda', Icono: Calendar },
    { key: 'llamada', label: 'Llamada', Icono: Clock },
    { key: 'venta', label: 'Venta', Icono: CheckCircle2 },
];

/** En qué paso del recorrido quedó esta fila, y si alguno se rompió (no show). */
const recorridoDe = (fila) => {
    if (fila.tipo === 'lead') {
        const hasta = fila.agendo ? 3 : fila.cualificado ? 2 : fila.respondio ? 1 : 0;
        return { hasta, fallo: null };
    }
    // Una venta y un cliente de la cartera están, por definición, al final del recorrido.
    if (fila.tipo === 'venta' || fila.tipo === 'cliente') return { hasta: 5, fallo: null };
    const post = fila.post_call?.key;
    if (post === 'venta') return { hasta: 5, fallo: null };
    if (post === 'no_show') return { hasta: 3, fallo: 4 };
    if (fila.asistio) return { hasta: 4, fallo: null };
    return { hasta: 3, fallo: null };
};

/** Cada paso con su tono y su rótulo de estado, para que el recorrido se lea sin leyenda. */
const estadoDePaso = (i, hasta, fallo) => {
    if (i === fallo) return { estado: 'No show', tone: 'error' };
    if (i <= hasta) return { estado: 'Completado', tone: 'success' };
    return { estado: 'Pendiente', tone: 'idle' };
};

const Meta = ({ label, valor, color }) => (
    <div>
        <span className="t-rotulo">{label}</span>
        <span className="trunc" style={{ fontSize: 13, fontWeight: 900, color }}>{valor || '—'}</span>
    </div>
);

const LeadModal = ({ fila, estados, puedeCorregir, onCorregir, onCerrar }) => {
    const [guardado, setGuardado] = useState(null);
    const [guardando, setGuardando] = useState(null);

    // El aviso de "Guardado" es de ESTA fila: al abrir otra no tiene por qué seguir ahí.
    useEffect(() => { setGuardado(null); }, [fila?.id]);

    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onCerrar]);

    // Con el modal abierto la página de atrás no se mueve: `.modal` ya contiene su propio scroll.
    useEffect(() => {
        if (!fila) return undefined;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [fila]);

    if (!fila) return null;

    const { hasta, fallo } = recorridoDe(fila);
    const esAgenda = fila.tipo === 'agenda';
    const esVenta = fila.tipo === 'venta';

    const corregir = async (campo, valor) => {
        setGuardando(`${campo}:${valor}`);
        try {
            await onCorregir(fila, campo, valor);
            setGuardado('Guardado · se actualizó en la tabla y en los totales');
        } finally {
            setGuardando(null);
        }
    };

    // Una agenda vencida sin resultado se anuncia con el retraso en el chip: es el dato por el
    // que se abre la fila.
    const chipHeader = esAgenda && fila.retraso_dias > 0
        ? { key: 'retraso', label: `Pendiente · ${fila.retraso_dias} d de retraso`, tone: 'warning' }
        : fila.post_call || fila.estado || fila.tipo_pago;

    const derivado = esAgenda
        && ['venta', 'seguimiento', 'presento_no_cerro'].includes(fila.post_call.key);

    return (
        <div className="scrim"
            onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal" role="dialog" aria-modal="true"
                aria-label={`Detalle de ${fila.cliente}`}>
                <div className="modal-cab">
                    <span className="modal-avatar">{fmt.iniciales(fila.cliente)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                            <h2 className="t-h3 trunc">{fila.cliente}</h2>
                            <ChipTono chip={chipHeader} />
                        </div>
                        {fila.ig && <p className="t-cap mut40" style={{ marginTop: 4 }}>{fila.ig}</p>}
                        <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
                            <span className="t-cap mut fila" style={{ gap: 6 }}>
                                <Mail size={13} />
                                <span className="trunc">{fila.email || 'Sin email'}</span>
                            </span>
                            <span className="t-cap mut fila num" style={{ gap: 6 }}>
                                <Phone size={13} />
                                {fila.telefono || 'Sin teléfono'}
                            </span>
                        </div>
                    </div>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar">
                        <X size={17} />
                    </button>
                </div>

                <div className="modal-meta">
                    <Meta label="Fuente" valor={fila.fuente} color="var(--brand-secondary)" />
                    <Meta label={fila.tipo === 'lead' ? 'Setter' : 'Closer'}
                        valor={fila.closer || fila.setter} color="var(--text-on-surface)" />
                    <Meta label={esVenta ? 'Programa' : 'Reunión'}
                        valor={esVenta ? fila.programa
                            : `${fmt.fecha(fila.fecha)} · ${fmt.hora(fila.fecha)}`}
                        color="var(--text-on-surface)" />
                    <Meta label={esVenta ? 'Cobrado' : 'Ingresó'}
                        valor={esVenta ? fmt.money(fila.monto) : fmt.fecha(fila.creada)}
                        color={esVenta ? 'var(--success)' : 'var(--text-muted)'} />
                </div>

                <div className="tarjeta" style={{ marginBottom: 'var(--s4)' }}>
                    <p className="t-rotulo" style={{ marginBottom: 'var(--s4)' }}>Recorrido del lead</p>
                    <div className="ruta">
                        {PASOS.map((p, i) => {
                            const { estado, tone } = estadoDePaso(i, hasta, fallo);
                            return (
                                <div key={p.key} className="ruta-paso" style={{ '--c': `var(--${tone})` }}>
                                    <span className="ruta-punto"><p.Icono size={16} /></span>
                                    <span className="ruta-lbl">{p.label}</span>
                                    <span className="ruta-est">{estado}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {esAgenda && (
                    <div className="tarjeta" style={{ display: 'grid', gap: 'var(--s3)' }}>
                        <span className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <Pencil size={14} className="mut" />
                            <span className="t-rotulo">Corregir estado</span>
                            {guardado && (
                                <span className="t-cap" style={{ marginLeft: 'auto',
                                    color: 'var(--success)', fontWeight: 700 }}>
                                    {guardado}
                                </span>
                            )}
                        </span>

                        {!puedeCorregir ? (
                            <p className="t-cap mut40">
                                Solo puede corregirla quien la atiende o la dirección comercial.
                            </p>
                        ) : (
                            <>
                                {[['pre_call', 'Pre call'], ['post_call', 'Estado de la llamada']].map(([campo, label]) => (
                                    <div key={campo} style={{ display: 'grid', gap: 'var(--s2)' }}>
                                        <span className="t-cap mut40">{label}</span>
                                        <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                                            {/* Solo el vocabulario real del mazo del closer: los
                                                estados derivados llegan con `editable: false`. */}
                                            {estados[campo].filter(o => o.editable !== false).map(o => {
                                                const activo = fila[campo].key === o.key;
                                                return (
                                                    <button key={o.key} type="button" className="chip"
                                                        disabled={guardando !== null}
                                                        aria-pressed={activo}
                                                        style={{
                                                            '--c': `var(--${activo ? o.tone : 'idle'})`,
                                                            height: 28,
                                                            padding: '0 12px',
                                                            textTransform: 'none',
                                                            letterSpacing: 0,
                                                            fontWeight: 600,
                                                            fontSize: 12.5,
                                                            ...(activo ? {} : {
                                                                background: 'transparent',
                                                                borderColor: 'var(--border-control)',
                                                                color: 'var(--text-muted)',
                                                            }),
                                                        }}
                                                        onClick={() => !activo && corregir(campo, o.key)}>
                                                        {o.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* "Venta", "Seguimiento" y "Presentó, no cerró" NO son editables:
                                    son estados derivados (una venta cruzada por contacto, un
                                    seguimiento abierto) y fijarlos a mano marcaría una venta que no
                                    existe en la contabilidad. Se explica en línea para que nadie los
                                    busque en la lista de arriba. */}
                                {derivado && (
                                    <p className="t-cap mut40">
                                        «{fila.post_call.label}» sale de los datos, no de un campo: una
                                        venta cruzada con este contacto, o un seguimiento abierto. Se
                                        corrige donde se genera.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadModal;
