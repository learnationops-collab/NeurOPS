import React, { useState } from 'react';
import ModalAgendasTaller from './ModalAgendasTaller';
import './agendas.css';

/**
 * El número de agendas de un taller, tocable: abre el modal con la lista de esas agendas. Lleva su
 * propio modal, así quien lo pone (la tabla, la tarjeta, el detalle) no tiene que alojarlo.
 *
 * `children` es lo que se ve como botón (por defecto, el número). Dentro de una fila clicable el clic
 * no la abre: el botón corta la propagación, como la casilla de comparar.
 */
const AgendasDelTaller = ({ evento, formatDate = null, children = null, className = '' }) => {
    const [abierto, setAbierto] = useState(false);
    const n = evento.agendas_exitosas ?? 0;

    const abrir = (ev) => {
        ev.stopPropagation();
        setAbierto(true);
    };

    return (
        <>
            <button type="button" className={`agm-num ${className}`.trim()} onClick={abrir}
                onKeyDown={(ev) => ev.stopPropagation()}
                title="Ver las agendas de este taller" aria-haspopup="dialog"
                aria-label={`Ver ${n === 1 ? 'la agenda' : `las ${n} agendas`} de ${evento.name}`}>
                {children ?? n.toLocaleString('en-US')}
            </button>
            {abierto && (
                <span onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
                    <ModalAgendasTaller tallerIds={[evento.id]} titulo={evento.name} esperado={n}
                        subtitulo={formatDate ? formatDate(evento.date) : evento.date}
                        onCerrar={() => setAbierto(false)} />
                </span>
            )}
        </>
    );
};

export default AgendasDelTaller;
