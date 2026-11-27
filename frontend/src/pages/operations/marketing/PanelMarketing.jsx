import React, { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import './panelMarketing.css';

/**
 * Learnation Marketing (el artifact de claude.ai) dentro de /ops/dashboard?step=marketing (ADR-W278).
 *
 * La página es el HTML del artifact con su puente (`app/marketing_app/puente.js`), en un iframe del mismo
 * origen (`srcdoc`): usa la sesión de Work, y `/_blob/…` y los links de los creativos resuelven contra Work.
 * Ocupa toda la pantalla menos el dock de Operaciones: el iframe se mide contra el dock (abajo o al costado)
 * para que nunca quede uno encima del otro.
 */
const useLugarDelDock = () => {
    const [lugar, setLugar] = useState({ top: 0, left: 0, right: 0, bottom: 112 });
    useEffect(() => {
        const medir = () => {
            const dock = document.querySelector('.operador-espacio .dc-shell .dock');
            if (!dock) return;
            const r = dock.getBoundingClientRect();
            const ancho = window.innerWidth;
            const alto = window.innerHeight;
            if (r.top > alto / 2) setLugar({ top: 0, left: 0, right: 0, bottom: Math.max(0, alto - r.top) + 10 });
            else if (r.left < ancho / 2) setLugar({ top: 0, left: r.right + 10, right: 0, bottom: 0 });
            else setLugar({ top: 0, left: 0, right: ancho - r.left + 10, bottom: 0 });
        };
        medir();
        const obs = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
        const dock = document.querySelector('.operador-espacio .dc-shell .dock');
        if (obs && dock) obs.observe(dock);
        window.addEventListener('resize', medir);
        const t = setInterval(medir, 1500);
        return () => { obs?.disconnect(); window.removeEventListener('resize', medir); clearInterval(t); };
    }, []);
    return lugar;
};

export default function PanelMarketing() {
    const [html, setHtml] = useState(null);
    const [error, setError] = useState('');
    const marco = useRef(null);
    const lugar = useLugarDelDock();

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
