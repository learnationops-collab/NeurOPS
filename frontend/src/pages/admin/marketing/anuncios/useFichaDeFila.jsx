import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Trash2 } from 'lucide-react';
import FichaLeadModal from '../../../../components/ficha/FichaLeadModal';
import ModalEliminarLead from '../../../../components/ficha/piezas/ModalEliminarLead';
import { ejecutarAccion } from '../../../../components/ficha/fichaApi';
import { useAuth } from '../../../../contexts/AuthContext';

/**
 * Abrir la ficha del lead (solo lectura) y eliminar leads de prueba desde una fila de las listas de cifras de Marketing
 * y Workshop (03/11/2026). El backend le pone `ficha` a cada fila de una persona (`app/services/ficha_de_fila.py`):
 * `{appointment_id}`, `{client_id}` o `{person_uuid}`. Una fila sin `ficha` (una campaña, un anuncio) no se abre.
 *
 * El tacho va en las filas con agenda o con cliente (`ficha.appointment_id` o `ficha.client_id`: un lead que solo está
 * en el libro de agendas se elimina por su cliente) y a quien puede eliminar leads (los mismos roles que `permisos_de`). Una fila eliminada se saca de la lista (`borrados`): las listas filtran por `sinBorrados`.
 *
 * `modal` va una vez en la lista. La ficha sale a `body` en un contexto de apilado por encima de la ventana de la
 * lista (z 170) y por debajo del widget de bugs, igual que la de las agendas de un taller.
 */
export const tieneFicha = (fila) => !!fila?.ficha;

const ROLES_QUE_ELIMINAN = ['admin', 'director_comercial', 'director_marketing', 'closer', 'triage'];

/** La columna de la flecha (y del tacho, si se pasa `onEliminar`): solo si alguna fila se puede abrir. */
export const columnaVer = (filas, onEliminar = null) => (filas.some(tieneFicha) ? [{
    key: 'ver', header: '', width: onEliminar ? '84px' : '44px', ordenable: false, fija: true,
    render: (f) => {
        if (!tieneFicha(f)) return null;
        const nombre = f.persona || f.cliente || 'este lead';
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {onEliminar && (f.ficha.appointment_id || f.ficha.client_id) && (
                    <button type="button" className="ibtn ibtn--sm ibtn--borrar" aria-haspopup="dialog"
                        aria-label={`Eliminar a ${nombre}`} title="Eliminar el lead de prueba"
                        onClick={(e) => { e.stopPropagation(); onEliminar(f); }}
                        onKeyDown={(e) => e.stopPropagation()}>
                        <Trash2 />
                    </button>
                )}
                <span className="celda-ver"><ArrowRight size={14} /></span>
            </span>
        );
    },
}] : []);

/** El texto de búsqueda de una fila sin la clave de la ficha, que no es un dato que se lea. */
export const textoDeFila = (fila) => Object.entries(fila).filter(([k]) => k !== 'ficha').map(([, v]) => v).join(' ');

export const useFichaDeFila = () => {
    const { user } = useAuth() || {};
    const [fila, setFila] = useState(null);
    const [aEliminar, setAEliminar] = useState(null);
    const [borrados, setBorrados] = useState(() => new Set());
    const puedeEliminar = ROLES_QUE_ELIMINAN.includes(user?.role);

    const abrir = useCallback((f) => { if (tieneFicha(f)) setFila(f); }, []);
    const marcarBorrada = useCallback((f) => setBorrados((antes) => new Set(antes).add(f.id)), []);

    // Escape cierra la ficha y nada más: la ventana de la lista que hay debajo también escucha Escape y se iría con ella.
    useEffect(() => {
        if (!fila || aEliminar) return undefined;
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            setFila(null);
        };
        window.addEventListener('keydown', escape, true);
        return () => window.removeEventListener('keydown', escape, true);
    }, [fila, aEliminar]);

    const ficha = fila?.ficha;
    const modal = (
        <>
            {ficha && createPortal(
                <div style={{ position: 'relative', zIndex: 175 }}>
                    <FichaLeadModal appointmentId={ficha.appointment_id ?? null} clientId={ficha.client_id ?? null}
                        personUuid={ficha.person_uuid ?? null} soloLectura onCerrar={() => setFila(null)}
                        onCambio={(nombre) => { if (nombre === 'eliminar_lead') marcarBorrada(fila); }} />
                </div>,
                document.body,
            )}
            {aEliminar && (
                <ModalEliminarLead agendaId={aEliminar.ficha.appointment_id ?? null}
                    clienteId={aEliminar.ficha.appointment_id ? null : aEliminar.ficha.client_id}
                    nombre={aEliminar.persona || aEliminar.cliente} onCerrar={() => setAEliminar(null)}
                    eliminar={async (conPlata) => {
                        const carga = conPlata ? { con_plata: true } : {};
                        if (aEliminar.ficha.appointment_id) await ejecutarAccion('eliminar_lead', aEliminar.ficha.appointment_id, carga);
                        else await ejecutarAccion('eliminar_lead_cliente', aEliminar.ficha.client_id, carga);
                        marcarBorrada(aEliminar);
                    }} />
            )}
        </>
    );
    // Las listas filtran con esto y dibujan el tacho con `onEliminar`.
    const sinBorrados = useCallback((filas) => filas.filter((f) => !borrados.has(f.id)), [borrados]);
    const onEliminar = useMemo(() => (puedeEliminar ? setAEliminar : null), [puedeEliminar]);
    return { abrir, modal, sinBorrados, onEliminar };
};
