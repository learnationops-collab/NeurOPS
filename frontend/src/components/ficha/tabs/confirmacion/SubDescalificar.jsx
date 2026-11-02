import React, { useState } from 'react';
import { TextArea } from '../../../standard';
import { SubVista } from '../../piezas';

/**
 * El closer ve al confirmar que el lead no calificaba.
 *
 * Es una cancelación por decisión del closer —la llamada no se hace y se libera su agenda— pero queda
 * marcada como «Descalificada» y no como «Canceló»: la dirección comercial cuenta cuántas agendas
 * descalifican los closers, aparte de las que el formulario de agenda corta solas.
 *
 * Reemplaza al «Descartar lead» de la confirmación, que marcaba «No Lead»: era lo mismo, y la dirección
 * los cuenta juntos. No es «Canceló» (ahí el lead sigue vivo y se agenda un seguimiento): quien no
 * califica sale del embudo, así que no hay seguimiento. El motivo es obligatorio y de texto libre (sin lista
 * cerrada, 02/11/2026): «descalificado» sin motivo no dice por qué entró una agenda que no servía.
 */
const SubDescalificar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState('');
    const texto = motivo.trim();

    return (
        <SubVista titulo="Descalificar lead" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={texto.length < 3 || guardando}
                    onClick={() => onConfirmar({ motivo: texto })}>
                    {guardando ? 'Descalificando…' : 'Descalificar lead'}
                </button>
            )}>
            <p className="t-cap mut">
                La llamada se cancela y se libera tu agenda. Queda marcada como descalificada y el lead sale
                del embudo.
            </p>

            <div style={{ display: 'grid', gap: 'var(--s1)' }}>
                <small className="t-rotulo">¿Por qué no califica?</small>
                <TextArea rows={3} aria-label="Motivo de la descalificación" value={motivo} autoFocus
                    placeholder="Qué viste: dinero, perfil, interés…" onChange={(e) => setMotivo(e.target.value)} />
            </div>
        </SubVista>
    );
};

export default SubDescalificar;
