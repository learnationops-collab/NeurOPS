import React, { useContext, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import VolverArriba from './volverArriba';

/**
 * Marco de toda sub-vista del panel: título, cuerpo y el pie con la acción.
 *
 * Es la pieza que hace posible la regla "un solo modal": una acción abre una
 * sub-vista DENTRO del panel, nunca un diálogo encima del diálogo.
 *
 * `Volver` va en la cabecera de la ficha, al lado de cerrar (25/11/2026): la sub-vista lo registra
 * en `VolverArriba` mientras está abierta. Fuera de la ficha (sin ese contexto) vuelve al pie, a la
 * izquierda. El pie solo aparece si hay `acciones`.
 *
 * `extra` va en la fila del título, a la derecha (controles del paso).
 */
const SubVista = ({ titulo, onVolver, acciones = null, aviso = null, extra = null, children }) => {
    const arriba = useContext(VolverArriba);
    // El volver cambia en cada render (los asistentes vuelven al paso anterior): se registra una sola
    // función estable que llama al último.
    const ultimo = useRef(onVolver);
    ultimo.current = onVolver;
    useEffect(() => {
        if (!arriba) return undefined;
        arriba.registrar(() => ultimo.current?.());
        return () => arriba.registrar(null);
    }, [arriba]);

    const pie = arriba ? acciones && (
        <div className="fi-pie" style={{ justifyContent: 'flex-end' }}>
            <div className="fi-pie-der">{acciones}</div>
        </div>
    ) : (
        <div className="fi-pie" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn--linea" onClick={onVolver}>
                <ArrowLeft size={14} />
                Volver
            </button>
            {acciones && <div className="fi-pie-der">{acciones}</div>}
        </div>
    );

    return (
        <div style={{ display: 'grid', gap: 'var(--s4)' }}>
            {extra ? (
                <div className="fi-sub-cab">
                    <h3 className="t-h3">{titulo}</h3>
                    {extra}
                </div>
            ) : <h3 className="t-h3">{titulo}</h3>}
            {aviso}
            {children}
            {pie}
        </div>
    );
};

export default SubVista;
