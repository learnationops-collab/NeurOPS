import React from 'react';
import { MessagesSquare } from 'lucide-react';
import { Modal, ModalHeader } from '../../../components/standard';

/**
 * Las conversaciones que suma un número que contó el Inbox (ADR-W185): quién, en qué fase está y la
 * hora, con un link a su chat en Conversaciones. `lista` viene del `detalle` de la precarga.
 */
const FASES = {
    apertura: '1 Apertura', conexion: '2 Conexión', dolor: '3 Dolor', consecuencia: '4 Consecuencia',
    compromiso: '5 Compromiso', propuesta: '6 Propuesta', link: '7 Link', confirmacion: '8 Confirmación',
    nolead: 'No lead', inabrible: 'In-abrible',
};

const hora = (iso) => (iso ? new Date(iso).toLocaleString('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const ListaInbox = ({ titulo, regla, lista, onCerrar }) => (
    <Modal onClose={onCerrar} labelledBy="rd-lista-t" className="rd-lista-modal">
        <ModalHeader icon={<MessagesSquare size={18} aria-hidden="true" />} title={titulo} titleId="rd-lista-t" subtitle={regla} onClose={onCerrar} />
        {lista.length ? (
            <ul className="rd-lista">
                {lista.map((c, i) => (
                    <li key={`${c.id}-${i}`}>
                        <b>@{c.quien}</b>
                        {c.fase && <span className={`rd-lista-fase${['nolead', 'inabrible'].includes(c.fase) ? ' fuera' : ''}`}>{FASES[c.fase] || c.fase}</span>}
                        <span className="rd-lista-h">{hora(c.en)}</span>
                        <a href={`/setter/deck?step=conversaciones&c=${c.id}`} target="_blank" rel="noopener noreferrer">Abrir chat ›</a>
                    </li>
                ))}
            </ul>
        ) : <p className="rd-lista-vacia">Ninguna conversación suma este número.</p>}
    </Modal>
);

export default ListaInbox;
