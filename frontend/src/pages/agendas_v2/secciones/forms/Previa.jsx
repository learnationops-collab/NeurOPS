// Vista previa: la pantalla real del lead, funcionando, dentro de un marco de escritorio (1280×800)
// o de celular (390×780) achicado para que entre.

import { useLayoutEffect, useMemo, useRef } from 'react';
import PantallaLead from '../../reserva/PantallaLead';

export default function Previa({ f, prevModo }) {
    const marco = useRef(null), escala = useRef(null);
    const fuente = useMemo(() => ({ form: f }), [f]);
    useLayoutEffect(() => {
        const m = marco.current, e = escala.current;
        if (!m || !e) return;
        const ajustar = () => e.style.setProperty('--k', (m.clientWidth / (prevModo === 'celular' ? 390 : 1280)).toFixed(4));
        ajustar();
        if (!window.ResizeObserver) { window.addEventListener('resize', ajustar); return () => window.removeEventListener('resize', ajustar); }
        const ro = new ResizeObserver(ajustar);
        ro.observe(m);
        return () => ro.disconnect();
    }, [prevModo]);
    return (
        <div className="previa">
            <div className="rv-marco" ref={marco} data-modo={prevModo}>
                <div className="rv-escala" ref={escala}>
                    <PantallaLead fuente={fuente} modo="embebida" prevModo={prevModo} />
                </div>
            </div>
        </div>
    );
}
