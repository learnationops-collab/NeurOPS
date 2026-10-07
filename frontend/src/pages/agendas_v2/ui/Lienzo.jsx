// Lienzo navegable tipo Miro: se arrastra para moverse, la rueda (o los botones) hace zoom hacia el
// cursor, «Ajustar» encuadra todo y «Pantalla completa» lo agranda sobre la página. El contenido se
// dibuja a tamaño natural y se escala con transform: no cambia su layout.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icono } from './base';

const MIN = 0.3, MAX = 2, PASO = 1.2, MARGEN = 32;
const limitar = (k) => Math.min(MAX, Math.max(MIN, k));

// encima: lo que flota sobre el lienzo sin escalarse (un inspector), también en pantalla completa.
export default function Lienzo({ children, alto = '68vh', etiqueta = 'Lienzo', ancho = 1100, encima = null }) {
    const vista = useRef(null), cont = useRef(null), arrastre = useRef(null);
    const [t, setT] = useState({ x: MARGEN, y: MARGEN, k: 1 });
    const [grande, setGrande] = useState(false);

    // Encuadra el contenido completo (sin agrandarlo más allá de 1:1).
    const ajustar = useCallback(() => {
        const v = vista.current, c = cont.current;
        if (!v || !c) return;
        const w = c.offsetWidth, h = c.offsetHeight, vw = v.clientWidth, vh = v.clientHeight;
        if (!w || !h || !vw || !vh) return;
        const k = limitar(Math.min(1, (vw - MARGEN * 2) / w, (vh - MARGEN * 2) / h));
        setT({ k, x: (vw - w * k) / 2, y: Math.max(MARGEN, (vh - h * k) / 2) });
    }, []);
    useLayoutEffect(() => { ajustar(); }, [ajustar, grande]);

    // Zoom hacia un punto de la vista (el cursor, o el centro con los botones).
    const zoom = useCallback((f, px, py) => {
        const v = vista.current;
        if (!v) return;
        const cx = px != null ? px : v.clientWidth / 2, cy = py != null ? py : v.clientHeight / 2;
        setT(p => {
            const k = limitar(p.k * f);
            return { k, x: cx - (cx - p.x) * (k / p.k), y: cy - (cy - p.y) * (k / p.k) };
        });
    }, []);

    // La rueda hace zoom; con passive:false para que no mueva la página. Shift o el trackpad en
    // horizontal mueven a los costados.
    useEffect(() => {
        const v = vista.current;
        if (!v) return undefined;
        const rueda = (e) => {
            e.preventDefault();
            const r = v.getBoundingClientRect();
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) setT(p => ({ ...p, x: p.x - e.deltaX }));
            else zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
        };
        v.addEventListener('wheel', rueda, { passive: false });
        return () => v.removeEventListener('wheel', rueda);
    }, [zoom]);

    useEffect(() => {
        if (!grande) return undefined;
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setGrande(false); } };
        document.addEventListener('keydown', esc, true);
        return () => document.removeEventListener('keydown', esc, true);
    }, [grande]);

    // Arrastrar mueve el lienzo; un clic sobre un botón o un campo sigue funcionando.
    const bajar = (e) => {
        if (e.button !== 0 || e.target.closest('button,a,input,select,textarea,[role="button"]')) return;
        arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    };
    const mover = (e) => {
        const a = arrastre.current;
        if (!a || a.id !== e.pointerId) return;
        const dx = e.clientX - a.x, dy = e.clientY - a.y;
        a.x = e.clientX; a.y = e.clientY;
        setT(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    };
    const soltar = () => { arrastre.current = null; };
    const tecla = (e) => {
        if (e.target !== e.currentTarget) return;
        const d = 60, m = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
        if (m) { e.preventDefault(); setT(p => ({ ...p, x: p.x + m[0], y: p.y + m[1] })); }
        else if (e.key === '+' || e.key === '=') zoom(PASO);
        else if (e.key === '-') zoom(1 / PASO);
        else if (e.key === '0') ajustar();
    };

    return (
        <div className={'lienzo' + (grande ? ' lienzo--grande' : '')} style={{ '--lienzo-alto': alto }}>
            <div className="lienzo-vista" ref={vista} role="region" tabIndex={0}
                aria-label={etiqueta + '. Arrastrá para moverte; la rueda o + y - hacen zoom; 0 ajusta.'}
                onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla}>
                <div className="lienzo-cont" ref={cont} style={{ width: ancho, transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>
                    {children}
                </div>
            </div>
            {encima}
            <div className="lienzo-ctl" role="toolbar" aria-label="Zoom">
                <button type="button" className="ibtn ibtn--sm" aria-label="Alejar" title="Alejar" onClick={() => zoom(1 / PASO)}><Icono n="zoom-out" s={15} /></button>
                <span className="lienzo-pct num" aria-live="polite">{Math.round(t.k * 100)}%</span>
                <button type="button" className="ibtn ibtn--sm" aria-label="Acercar" title="Acercar" onClick={() => zoom(PASO)}><Icono n="zoom-in" s={15} /></button>
                <button type="button" className="ibtn ibtn--sm" aria-label="Ajustar a la pantalla" title="Ajustar" onClick={ajustar}><Icono n="encuadre" s={15} /></button>
                <button type="button" className="ibtn ibtn--sm" aria-label={grande ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    title={grande ? 'Salir (Esc)' : 'Pantalla completa'} aria-pressed={grande} onClick={() => setGrande(g => !g)}>
                    <Icono n={grande ? 'contraer' : 'expandir'} s={15} />
                </button>
            </div>
        </div>
    );
}
