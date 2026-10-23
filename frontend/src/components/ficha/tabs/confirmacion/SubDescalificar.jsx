import React, { useState } from 'react';
import { DesplegableAgrupado, SubVista } from '../../piezas';
import { grupos } from '../../estadoFicha';

/**
 * El closer ve al confirmar que el lead no calificaba.
 *
 * Es una cancelación por decisión del closer —la llamada no se hace y se libera su agenda— pero queda
 * marcada como «Descalificada» y no como «Canceló»: la dirección comercial cuenta cuántas agendas
 * descalifican los closers, aparte de las que el formulario de agenda corta solas.
 *
 * Reemplaza al «Descartar lead» de la confirmación, que marcaba «No Lead»: era lo mismo, y la dirección
 * los cuenta juntos. No es «Canceló» (ahí el lead sigue vivo y se agenda un seguimiento): quien no
 * califica sale del embudo, así que no hay seguimiento. El motivo es obligatorio, porque «descalificado»
 * sin motivo no dice por qué entró una agenda que no servía.
 */
const SubDescalificar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState(null);
    const listas = grupos(ficha, 'motivos_descalificacion');

    return (
        <SubVista titulo="Descalificar lead" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!motivo || guardando}
                    onClick={() => onConfirmar({ motivo })}>
                    {guardando ? 'Descalificando…' : 'Descalificar lead'}
                </button>
            )}>
            <p className="t-cap mut">
                La llamada se cancela y se libera tu agenda. Queda marcada como descalificada y el lead sale
                del embudo.
            </p>

            <DesplegableAgrupado rotulo="¿Por qué no califica?" etiqueta="Motivo de la descalificación"
                placeholder="Elegí un motivo" grupos={listas}
                valor={motivo} onChange={setMotivo}
                onAgregar={() => {}} />
        </SubVista>
    );
};

export default SubDescalificar;
