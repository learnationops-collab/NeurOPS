import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, X, ArrowRight, MousePointerClick, Check } from 'lucide-react';
import Mock from './Mocks';

// El recorrido por Work (ADR-W218): oscurece la pantalla menos el lugar del paso (un agujero con un
// aro que late) y pone al lado la tarjeta con su escena. Si el lugar no está (no hay llamadas, otra
// vista), la tarjeta va al centro y el paso igual se explica con su escena.

const ANCHO = 380;
const MARGEN = 16;
const AIRE = 8;
// El velo es más grande que cualquier pantalla: no depende del tamaño de la ventana.
const FONDO = 'M-5000 -5000H10000V10000H-5000Z';

// Espera hasta ~2,5 s a que aparezca el lugar del paso (la sección recién cambió).
const buscar = async (target, vivo) => {
    if (!target) return null;
    for (let i = 0; i < 12 && vivo(); i += 1) {
        const el = typeof target === 'function' ? target() : document.querySelector(target);
        if (el && el.getBoundingClientRect().width > 0) return el;
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
};

// Dónde va la tarjeta: al costado con más lugar; si el lugar es enorme, abajo a la izquierda adentro.
const ubicar = (r, alto) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const clampY = (y) => Math.max(MARGEN, Math.min(y, H - alto - MARGEN));
    const clampX = (x) => Math.max(MARGEN, Math.min(x, W - ANCHO - MARGEN));
    if (!r) return { x: (W - ANCHO) / 2, y: Math.max(MARGEN, (H - alto) / 2), lado: 'centro' };
    if (r.right + AIRE + MARGEN + ANCHO <= W - MARGEN) return { x: r.right + AIRE + MARGEN, y: clampY(r.top + r.height / 2 - alto / 2), lado: 'der' };
    if (r.left - AIRE - MARGEN - ANCHO >= MARGEN) return { x: r.left - AIRE - MARGEN - ANCHO, y: clampY(r.top + r.height / 2 - alto / 2), lado: 'izq' };
    if (r.top - AIRE - MARGEN - alto >= MARGEN) return { x: clampX(r.left + r.width / 2 - ANCHO / 2), y: r.top - AIRE - MARGEN - alto, lado: 'arriba' };
    if (r.bottom + AIRE + MARGEN + alto <= H - MARGEN) return { x: clampX(r.left + r.width / 2 - ANCHO / 2), y: r.bottom + AIRE + MARGEN, lado: 'abajo' };
    return { x: MARGEN * 2, y: Math.max(MARGEN, H - alto - 140), lado: 'adentro' };
};

const mismo = (a, b) => a && b && ['top', 'left', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) < 0.5);

const Recorrido = ({ pasos, ctx, onCerrar }) => {
    const [i, setI] = useState(0);
    const [el, setEl] = useState(null);
    const [rect, setRect] = useState(null);
    const [listo, setListo] = useState(false);
    const [alto, setAlto] = useState(340);
    const tarjeta = useRef(null);
    const paso = pasos[i];
    const ultimo = i === pasos.length - 1;

    const siguiente = () => (ultimo ? onCerrar() : setI(n => n + 1));
    const anterior = () => setI(n => Math.max(0, n - 1));

    // Al entrar a un paso: lo que Work hace antes, buscar el lugar y traerlo a la vista.
    useEffect(() => {
        let vivo = true;
        setListo(false);
        setEl(null);
        setRect(null);
        (async () => {
            try { paso.antes?.(ctx); } catch (e) { console.error(`Novedades: ${e}`); }
            await new Promise(r => setTimeout(r, paso.antes ? 350 : 60));
            const encontrado = await buscar(paso.target, () => vivo);
            if (!vivo) return;
            if (encontrado) {
                const r = encontrado.getBoundingClientRect();
                if (r.top < 0 || r.bottom > window.innerHeight) encontrado.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            setEl(encontrado);
            setListo(true);
        })();
        return () => { vivo = false; };
    }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

    // El lugar se sigue cuadro a cuadro: la página scrollea, el riel es sticky y las vistas se animan.
    useEffect(() => {
        if (!el) return undefined;
        let raf;
        const medir = () => {
            const r = el.getBoundingClientRect();
            const nuevo = { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
            setRect(prev => (mismo(prev, nuevo) ? prev : nuevo));
            raf = requestAnimationFrame(medir);
        };
        medir();
        return () => cancelAnimationFrame(raf);
    }, [el]);

    // «Tocá acá»: el toque real pasa (cambia la vista) y el recorrido avanza.
    useEffect(() => {
        if (!el || !paso.tocar) return undefined;
        const alTocar = () => setTimeout(siguiente, 380);
        el.addEventListener('click', alTocar);
        return () => el.removeEventListener('click', alTocar);
    }, [el, paso]); // eslint-disable-line react-hooks/exhaustive-deps

    useLayoutEffect(() => {
        if (tarjeta.current) setAlto(tarjeta.current.offsetHeight);
    }, [i, listo]);

    useEffect(() => {
        const tecla = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); }
            if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); siguiente(); }
            if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); anterior(); }
        };
        window.addEventListener('keydown', tecla, true);
        return () => window.removeEventListener('keydown', tecla, true);
    });

    const hueco = rect && {
        x: rect.left - AIRE, y: rect.top - AIRE, w: rect.width + AIRE * 2, h: rect.height + AIRE * 2,
    };
    const r = 18;
    const velo = hueco
        ? `${FONDO} M${hueco.x + r} ${hueco.y}H${hueco.x + hueco.w - r}a${r} ${r} 0 0 1 ${r} ${r}V${hueco.y + hueco.h - r}a${r} ${r} 0 0 1 -${r} ${r}H${hueco.x + r}a${r} ${r} 0 0 1 -${r} -${r}V${hueco.y + r}a${r} ${r} 0 0 1 ${r} -${r}Z`
        : FONDO;
    const pos = ubicar(rect, alto);

    return (
        <div className="nv-rec" role="dialog" aria-modal="true" aria-label="Recorrido por las novedades de Work">
            <svg className="nv-rec__velo" aria-hidden="true">
                <path d={velo} fillRule="evenodd" />
            </svg>
            {hueco && (
                <>
                    <span className="nv-rec__aro" style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} aria-hidden="true" />
                    {/* Sin «Tocá acá», el lugar se ve pero no se toca (abriría la ficha encima del recorrido). */}
                    {!paso.tocar && <span className="nv-rec__tapa" style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} />}
                    {paso.tocar && (
                        <span className="nv-rec__toca" style={{ left: hueco.x + hueco.w / 2, top: hueco.y + hueco.h + 10 }} aria-hidden="true">
                            <MousePointerClick />Tocá acá
                        </span>
                    )}
                </>
            )}

            {listo && (
                <div ref={tarjeta} key={paso.id} className={`nv-card nv-card--${pos.lado}`} style={{ left: pos.x, top: pos.y, width: ANCHO }}>
                    <span className="nv-card__aura" aria-hidden="true"><i /><i /><i /></span>
                    <div className="nv-card__barras" aria-hidden="true">
                        {pasos.map((p, k) => <i key={p.id} className={k < i ? 'is-ya' : k === i ? 'is-ahora' : ''} />)}
                    </div>
                    <button type="button" className="nv-card__x" onClick={onCerrar} aria-label="Cerrar el recorrido"><X /></button>
                    <div className="nv-card__escena"><Mock tipo={paso.mock} /></div>
                    <h3 className="nv-card__titulo">{paso.titulo}</h3>
                    {paso.texto && <p className="nv-card__texto">{paso.texto}</p>}
                    <div className="nv-card__pie">
                        {i > 0 && (
                            <button type="button" className="nv-card__atras" onClick={anterior} aria-label="Anterior"><ChevronLeft /></button>
                        )}
                        {paso.accion && (
                            <button type="button" className="nv-card__sec" onClick={() => { onCerrar(); paso.accion.hacer(ctx); }}>
                                {paso.accion.label}
                            </button>
                        )}
                        <button type="button" className="nv-card__cta" onClick={siguiente} autoFocus>
                            {ultimo ? <><Check />Listo</> : <>Siguiente<ArrowRight /></>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recorrido;
