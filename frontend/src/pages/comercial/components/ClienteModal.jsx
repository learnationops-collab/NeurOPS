import React from 'react';
import { Mail, Phone, X } from 'lucide-react';
import EstadoCobroCliente from '../../../components/cobro/EstadoCobroCliente';

const iniciales = (nombre) => (nombre || '?')
    .split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/**
 * Detalle de una fila de la tabla Clientes.
 *
 * Esas filas abrían `LeadModal`, que es el modal de una AGENDA: recorrido del lead y corrección
 * de pre call / post call. Sobre un cliente que ya compró no hay nada de eso que corregir — de
 * hecho `puedeCorregirFila` devuelve false para todo lo que no sea una agenda, así que el modal
 * se abría sin una sola acción posible. Lo que sí hay es una cartera: qué debe, con qué cuota y
 * desde cuándo.
 *
 * Es solo lectura porque cobrar no es el trabajo de quien mira esta pantalla; el flujo con
 * acciones es el cockpit del closer, en su mazo.
 */
const ClienteModal = ({ fila, onCerrar }) => {
    if (!fila) return null;

    return (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label={`Cartera de ${fila.cliente}`}>
                <div className="modal-cab">
                    <span className="modal-avatar">{iniciales(fila.cliente)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 className="t-h3 trunc">{fila.cliente}</h2>
                        {fila.ig && <p className="t-cap mut40" style={{ marginTop: 4 }}>{fila.ig}</p>}
                        <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
                            <span className="t-cap mut fila" style={{ gap: 6 }}>
                                <Mail size={13} />
                                <span className="trunc">{fila.email || 'Sin email'}</span>
                            </span>
                            <span className="t-cap mut fila num" style={{ gap: 6 }}>
                                <Phone size={13} />
                                <span>{fila.telefono || 'Sin teléfono'}</span>
                            </span>
                            {fila.closer && (
                                <span className="t-cap mut">Vendió {fila.closer}</span>
                            )}
                        </div>
                    </div>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                <EstadoCobroCliente clientId={fila.client_id} />
            </div>
        </div>
    );
};

export default ClienteModal;
