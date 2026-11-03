import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import FichaLeadModal from '../../../../components/ficha/FichaLeadModal';

/**
 * Abrir la ficha del lead (solo lectura) desde una fila de las listas de cifras de Marketing y Workshop
 * (03/11/2026). El backend le pone `ficha` a cada fila de una persona (`app/services/ficha_de_fila.py`):
 * `{appointment_id}`, `{client_id}` o `{person_uuid}`. Una fila sin `ficha` (una campaña, un anuncio) no se abre.
 *
 * `modal` va una vez en la lista. La ficha sale a `body` en un contexto de apilado por encima de la ventana de la
 * lista (z 170) y por debajo del widget de bugs, igual que la de las agendas de un taller.
 */
export const tieneFicha = (fila) => !!fila?.ficha;

/** La columna de la flecha: solo si alguna fila se puede abrir. */
export const columnaVer = (filas) => (filas.some(tieneFicha) ? [{
    key: 'ver', header: '', width: '44px', ordenable: false, fija: true,
    render: (f) => (tieneFicha(f) ? <span className="celda-ver"><ArrowRight size={14} /></span> : null),
}] : []);

/** El texto de búsqueda de una fila sin la clave de la ficha, que no es un dato que se lea. */
export const textoDeFila = (fila) => Object.entries(fila).filter(([k]) => k !== 'ficha').map(([, v]) => v).join(' ');

export const useFichaDeFila = () => {
    const [ficha, setFicha] = useState(null);
    const abrir = useCallback((fila) => { if (tieneFicha(fila)) setFicha(fila.ficha); }, []);
    // Escape cierra la ficha y nada más: la ventana de la lista que hay debajo también escucha Escape y se iría con ella.
    useEffect(() => {
        if (!ficha) return undefined;
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            setFicha(null);
        };
        window.addEventListener('keydown', escape, true);
        return () => window.removeEventListener('keydown', escape, true);
    }, [ficha]);
    const modal = ficha && createPortal(
        <div style={{ position: 'relative', zIndex: 175 }}>
            <FichaLeadModal appointmentId={ficha.appointment_id ?? null} clientId={ficha.client_id ?? null}
                personUuid={ficha.person_uuid ?? null} soloLectura onCerrar={() => setFicha(null)} />
        </div>,
        document.body,
    );
    return { abrir, modal };
};
