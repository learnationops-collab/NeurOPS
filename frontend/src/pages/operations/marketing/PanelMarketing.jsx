import React, { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import './panelMarketing.css';

/**
 * Learnation Marketing (el artifact de claude.ai) dentro de /ops/dashboard?step=marketing (ADR-W278).
 *
 * La página es el HTML del artifact con su puente (`app/marketing_app/puente.js`), en un iframe del mismo
 * origen (`srcdoc`): usa la sesión de Work, y `/_blob/…` y los links de los creativos resuelven contra Work.
 *
 * Un solo dock (pedido de Mario, 27/11/2026): en pantalla ancha el iframe ocupa todo, la isla del centro del
 * dock de Work (la de «Marketing») se esconde (`.operador-espacio--marketing`, operadorEspacio.css) y las islas
 * de los costados (avisos, conflictos, reportes, Playbook, Learnito, Portal · Herramientas y la sesión) se
 * alinean a la altura del dock del artifact, una a cada lado. Angosto o con la barra lateral, el dock de Work
 * no tiene islas sueltas: el iframe se achica para no quedar debajo de él.
 */
const BARRA = '.operador-espacio .dc-shell .dock-barra';

const useLugar = (marco) => {
    const [lugar, setLugar] = useState({ top: 0, left: 0, right: 0, bottom: 0 });
    useEffect(() => {
        const medir = () => {
            const barra = document.querySelector(BARRA);
            if (barra) {
                setLugar((l) => (l.top || l.left || l.right || l.bottom ? { top: 0, left: 0, right: 0, bottom: 0 } : l));
                // Las islas al centro del dock del artifact (mismo origen: se puede medir adentro).
                const isla = barra.querySelector('.dock-isla');
                const suyo = marco.current?.contentDocument?.querySelector('.dock');
                if (isla && suyo) {
                    const a = suyo.getBoundingClientRect(), b = isla.getBoundingClientRect();
                    const actual = parseFloat(barra.style.getPropertyValue('--mk-dy')) || 0;
                    const dy = Math.round((a.top + a.height / 2) - (b.top + b.height / 2) + actual);
                    if (a.height && b.height && Math.abs(dy - actual) >= 1) barra.style.setProperty('--mk-dy', `${dy}px`);
                }
                return;
            }
            const dock = document.querySelector('.operador-espacio .dc-shell .dock, .operador-espacio .dock-lado');
            if (!dock) return;
            const r = dock.getBoundingClientRect();
            if (!r.width) return;
            const ancho = window.innerWidth, alto = window.innerHeight;
            if (r.top > alto / 2) setLugar({ top: 0, left: 0, right: 0, bottom: Math.max(0, alto - r.top) + 10 });
            else if (r.left < ancho / 2) setLugar({ top: 0, left: r.right + 10, right: 0, bottom: 0 });
            else setLugar({ top: 0, left: 0, right: ancho - r.left + 10, bottom: 0 });
        };
        medir();
        window.addEventListener('resize', medir);
        const t = setInterval(medir, 800);
        return () => {
            window.removeEventListener('resize', medir);
            clearInterval(t);
            document.querySelector(BARRA)?.style.removeProperty('--mk-dy');
        };
    }, [marco]);
    return lugar;
};

export default function PanelMarketing() {
    const [html, setHtml] = useState(null);
    const [error, setError] = useState('');
    const marco = useRef(null);
    const lugar = useLugar(marco);

    useEffect(() => {
        let vivo = true;
        api.get('/marketing-app/pagina', { responseType: 'text', transformResponse: (x) => x })
            .then((r) => { if (vivo) setHtml(r.data); })
            .catch((e) => { if (vivo) setError(e?.response?.status === 403 ? 'Tu cuenta no tiene Learnation Marketing.' : 'No se pudo abrir Learnation Marketing.'); });
        return () => { vivo = false; };
    }, []);

    return (
        <div className="panel-marketing" style={lugar}>
            {error && <p className="panel-marketing-error">{error}</p>}
            {!error && !html && <div className="panel-marketing-cargando" aria-label="Cargando" />}
            {html && (
                <iframe ref={marco} title="Learnation Marketing" srcDoc={html}
                    allow="clipboard-read; clipboard-write; microphone; fullscreen" />
            )}
        </div>
    );
}
