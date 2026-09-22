import React, { useEffect, useState } from 'react';
import { Calendar, Check, CheckCircle2, Clock, Inbox, Pencil, Target, X } from 'lucide-react';
import { Chip, fmt } from './Shared';

/**
 * Modal del lead: el detalle de una fila sin salir de Revisar.
 *
 * Trae el recorrido del lead (6 pasos), el bloque para corregir el estado y los datos de
 * contacto. Corregir un estado dispara `onCorregir`, que hace el PATCH y vuelve a pedir la tabla
 * y el resumen: el requisito es que la tabla, los chips y los totales se recalculen sin recargar.
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
    if (fila.tipo === 'venta') return { hasta: 5, fallo: null };
    const post = fila.post_call?.key;
    if (post === 'venta') return { hasta: 5, fallo: null };
    if (post === 'no_show') return { hasta: 3, fallo: 4 };
    if (fila.asistio) return { hasta: 4, fallo: null };
    return { hasta: 3, fallo: null };
};

const Meta = ({ label, valor, color }) => (
    <div>
        <div className="dc-total-label">{label}</div>
        <div className="ln-t-body-sm" style={{ color, marginTop: 4 }}>{valor || '—'}</div>
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

    if (!fila) return null;

    const { hasta, fallo } = recorridoDe(fila);
    const esAgenda = fila.tipo === 'agenda';

    const corregir = async (campo, valor) => {
        setGuardando(`${campo}:${valor}`);
        try {
            await onCorregir(fila, campo, valor);
            setGuardado('Guardado · se actualizó en la tabla y en los totales');
        } finally {
            setGuardando(null);
        }
    };

    const chipHeader = esAgenda && fila.retraso_dias > 0
        ? { key: 'retraso', label: `Pendiente · ${fila.retraso_dias} d de retraso`, tone: 'warning' }
        : fila.post_call || fila.estado || fila.tipo_pago;

    return (
        <div className="dc-scrim" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="dc-modal" role="dialog" aria-modal="true">
                <div className="dc-modal-head">
                    <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
                        <span className="dc-avatar-xl">{fmt.iniciales(fila.cliente)}</span>
                        <div style={{ minWidth: 0 }}>
                            <h3 className="ln-t-h3">{fila.cliente}</h3>
                            <p className="ln-t-caption ln-muted" style={{ marginTop: 4 }}>
                                {[fila.ig, fila.email, fila.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Chip chip={chipHeader} />
                        <button type="button" className="ln-iconbtn" onClick={onCerrar} aria-label="Cerrar">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="dc-meta">
                    <Meta label="Fuente" valor={fila.fuente || 'ManyChat'} color="var(--brand-secondary)" />
                    <Meta label={fila.tipo === 'lead' ? 'Setter' : 'Closer'} valor={fila.closer || fila.setter} />
                    <Meta label={fila.tipo === 'venta' ? 'Programa' : 'Reunión'}
                        valor={fila.tipo === 'venta' ? fila.programa
                            : `${fmt.fecha(fila.fecha)} · ${fmt.hora(fila.fecha)}`} />
                    <Meta label={fila.tipo === 'venta' ? 'Cobrado' : 'Ingresó'}
                        valor={fila.tipo === 'venta' ? fmt.money(fila.monto) : fmt.fecha(fila.creada)}
                        color={fila.tipo === 'venta' ? 'var(--success)' : undefined} />
                </div>

                <div className="dc-total-label" style={{ marginBottom: 10 }}>Recorrido</div>
                <div className="dc-road">
                    {PASOS.map((p, i) => {
                        const clase = i === fallo ? 'dc-road-dot--fail' : i <= hasta ? 'dc-road-dot--done' : '';
                        return (
                            <div key={p.key} className="dc-road-step">
                                <span className={`dc-road-dot ${clase}`}><p.Icono size={15} /></span>
                                <div className="ln-t-caption ln-muted-40">{p.label}</div>
                            </div>
                        );
                    })}
                </div>

                {esAgenda && (
                    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Pencil size={13} className="ln-muted" />
                            <span className="dc-total-label">Corregir estado</span>
                        </div>

                        {!puedeCorregir && (
                            <p className="ln-t-caption ln-muted-40" style={{ marginTop: 8 }}>
                                Solo puede corregirla quien la atiende o la dirección comercial.
                            </p>
                        )}

                        {puedeCorregir && (
                            <>
                                {[['pre_call', 'Pre call'], ['post_call', 'Post call']].map(([campo, label]) => (
                                    <div key={campo} style={{ marginTop: 12 }}>
                                        <div className="ln-t-caption ln-muted-40">{label}</div>
                                        <div className="dc-fix">
                                            {estados[campo].filter(o => o.editable !== false).map(o => {
                                                const activo = fila[campo].key === o.key;
                                                return (
                                                    <button key={o.key} type="button" className="dc-fix-opt"
                                                        disabled={guardando !== null}
                                                        style={activo ? {
                                                            background: `var(--${o.tone}-surface)`,
                                                            borderColor: `var(--${o.tone}-border)`,
                                                            color: `var(--${o.tone})`,
                                                        } : undefined}
                                                        onClick={() => !activo && corregir(campo, o.key)}>
                                                        {o.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* Los estados derivados no se fijan a mano: se explican para que nadie
                                    los busque en la lista de arriba. */}
                                {['venta', 'seguimiento', 'presento_no_cerro'].includes(fila.post_call.key) && (
                                    <p className="ln-t-caption ln-muted-40" style={{ marginTop: 12 }}>
                                        «{fila.post_call.label}» sale de los datos, no de un campo: una venta cruzada
                                        con este contacto, o un seguimiento abierto. Se corrige donde se genera.
                                    </p>
                                )}

                                {guardado && (
                                    <p className="ln-t-caption" style={{ color: 'var(--success)', marginTop: 12 }}>
                                        {guardado}
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
