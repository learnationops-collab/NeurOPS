import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Sección del historial: el resumen de una línea va en la cabecera para que el
 * dato se lea SIN abrirla. Abrir es para ver el detalle, no para enterarse.
 */
const SeccionColapsable = ({ titulo, resumen = null, abiertaPorDefecto = false, children }) => {
    const [abierta, setAbierta] = useState(abiertaPorDefecto);
    return (
        <div className="fi-sec">
            <button type="button" className="fi-sec-cab" aria-expanded={abierta}
                onClick={() => setAbierta(a => !a)}>
                <span className="fi-sec-tit">
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{titulo}</span>
                    {resumen && <span className="t-sm mut">{resumen}</span>}
                </span>
                <span className="mut" style={{ display: 'flex' }}>
                    {abierta ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
            </button>
            {abierta && <div className="fi-sec-cuerpo">{children}</div>}
        </div>
    );
};

export default SeccionColapsable;
