// El lienzo del flujo de un taller (ADR-W262), como ManyChat: cada paso es una fila y lo que sale de él crece hacia
// la derecha (paso → respuesta de cada botón → mensaje al abrir el link). Los cables se miden del DOM: van del
// enchufe de cada botón (`data-ancla`) al nodo que abre (`data-nodo`). Se arrastra con el mouse y tiene zoom.
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { partesDe } from '../broadcastWa/useBroadcast';
import { claveDespues, claveResp, NodoDespues, NodoPaso, NodoRespuesta } from './Nodos';
import { cuandoEnPalabras, fechaCorta } from './useBroadcastTaller';

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15];
const AZUL = '#5b9bff', VERDE = '#25D366';

/** Los cables de una fila: [ancla, nodo destino, color]. */
function cablesDe(i, botones, reglas) {
    const salida = [];
    botones.forEach((b) => {
        salida.push([`p${i}:b:${b}`, claveResp(i, b), AZUL]);
        const regla = reglas?.find((r) => r.boton === b);
        (regla?.botones || []).forEach((rb, k) => {
            if (rb.url != null && rb.despues) salida.push([`${claveResp(i, b)}:b${k}`, claveDespues(i, b), VERDE]);
            else if (rb.va_a) salida.push([`${claveResp(i, b)}:b${k}`, claveResp(i, rb.va_a), AZUL]);
        });
    });
    return salida;
}

function useCables(mundo, cables, escala, marca) {
    const [trazos, setTrazos] = useState([]);
    // La lista de cables se rearma en cada render: se mide solo cuando cambia su contenido (si no, es un bucle).
    const lista = useRef(cables);
    lista.current = cables;
    const clave = JSON.stringify(cables);
    const medir = useCallback(() => {
        const raiz = mundo.current;
        if (!raiz) return;
        const cables = lista.current;
        const base = raiz.getBoundingClientRect();
        const caja = (el) => {
            const r = el.getBoundingClientRect();
            return { x: (r.left - base.left) / escala, y: (r.top - base.top) / escala, w: r.width / escala, h: r.height / escala };
        };
        const nuevos = cables.map(([a, b, color]) => {
            const ea = raiz.querySelector(`[data-ancla="${CSS.escape(a)}"]`), eb = raiz.querySelector(`[data-nodo="${CSS.escape(b)}"]`);
            if (!ea || !eb) return null;
            const A = caja(ea), B = caja(eb);
            const x1 = A.x + A.w + 6, y1 = A.y + A.h / 2, x2 = B.x - 2, y2 = B.y + 22;
            // Hacia atrás (un botón que sigue a otra respuesta de la misma columna): el cable sale y vuelve.
            const d = x2 > x1 + 20
                ? `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`
                : `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}`;
            return { d, color, a: x1, b: y1 };
        }).filter(Boolean);
        setTrazos((viejos) => (JSON.stringify(viejos) === JSON.stringify(nuevos) ? viejos : nuevos));
    }, [mundo, clave, escala]); // eslint-disable-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        medir();
        const obs = new ResizeObserver(medir);
        if (mundo.current) obs.observe(mundo.current);
        return () => obs.disconnect();
    }, [medir, marca]); // eslint-disable-line react-hooks/exhaustive-deps
    return trazos;
}

/** Arrastrar el fondo mueve el lienzo (el scroll de la caja). */
function useArrastre(caja) {
    const desde = useRef(null);
    return {
        onPointerDown: (e) => {
            if (e.button !== 0 || e.target.closest('.lz-nodo, .lz-mas, .lz-zoom')) return;
            desde.current = { x: e.clientX, y: e.clientY, l: caja.current.scrollLeft, t: caja.current.scrollTop };
            caja.current.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e) => {
            if (!desde.current) return;
            caja.current.scrollLeft = desde.current.l - (e.clientX - desde.current.x);
            caja.current.scrollTop = desde.current.t - (e.clientY - desde.current.y);
        },
        onPointerUp: () => { desde.current = null; },
    };
}

export default function Lienzo({ pasos, plantillas, reglas, sel, onSel, onSumarPaso }) {
    const caja = useRef(null);
    const mundo = useRef(null);
    const [zoom, setZoom] = useState(3);
    const escala = ZOOMS[zoom];
    const filas = pasos.map((p, i) => {
        const plantilla = plantillas.find((x) => x.name === p.plantilla);
        const { botones } = partesDe(plantilla);
        const datos = reglas[p.plantilla];
        return { p, i, plantilla, botones, datos, respuestas: datos?.respuestas || [] };
    });
    const cables = filas.flatMap((f) => cablesDe(f.i, f.botones, f.respuestas));
    const trazos = useCables(mundo, cables, escala, JSON.stringify([pasos, reglas, sel]));
    const arrastre = useArrastre(caja);
    const es = (tipo, i, boton) => sel?.tipo === tipo && sel.i === i && (boton == null || sel.boton === boton);

    return (
        <div className="lz-caja" ref={caja} {...arrastre}>
            <div className="lz-zoom">
                <button type="button" aria-label="Alejar" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}><Minus /></button>
                <span>{Math.round(escala * 100)}%</span>
                <button type="button" aria-label="Acercar" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)}><Plus /></button>
            </div>
            {/* `zoom` y no `transform`: así el scroll de la caja sigue al tamaño real. */}
            <div className="lz-mundo" ref={mundo} style={{ zoom: escala }}>
                <svg className="lz-cables" aria-hidden="true">
                    {trazos.map((t, k) => (
                        <g key={k}>
                            <path d={t.d} stroke={t.color} strokeWidth="2" fill="none" />
                            <circle cx={t.a} cy={t.b} r="4" fill={t.color} />
                        </g>
                    ))}
                </svg>
                {filas.map(({ p, i, plantilla, botones, datos, respuestas }) => {
                    const conDespues = respuestas.filter((r) => botones.includes(r.boton) && (r.botones || []).some((b) => b.url != null && b.despues));
                    return (
                        <section key={p.id || `n${i}`} className="lz-fila" aria-label={p.nombre || `Paso ${i + 1}`}>
                            <span className="lz-cuando">{cuandoEnPalabras(p)}{p.momento && ` · ${fechaCorta(p.momento)}`}</span>
                            <div className="lz-cols">
                                <div className="lz-col">
                                    <NodoPaso i={i} paso={p} plantilla={plantilla} config={datos?.config} elegido={es('paso', i)}
                                        onElegir={() => onSel({ tipo: 'paso', i })} onBoton={(b) => onSel({ tipo: 'resp', i, boton: b })} />
                                </div>
                                {botones.length > 0 && (
                                    <div className="lz-col">
                                        {botones.map((b) => (
                                            <NodoRespuesta key={b} i={i} boton={b} regla={respuestas.find((r) => r.boton === b)} elegido={es('resp', i, b)}
                                                onElegir={() => onSel({ tipo: 'resp', i, boton: b })}
                                                onBoton={(rb) => onSel(rb.url != null ? { tipo: 'despues', i, boton: b } : { tipo: 'resp', i, boton: rb.va_a })} />
                                        ))}
                                    </div>
                                )}
                                {conDespues.length > 0 && (
                                    <div className="lz-col">
                                        {conDespues.map((r) => (
                                            <NodoDespues key={r.boton} i={i} boton={r.boton} despues={r.botones.find((b) => b.url != null).despues}
                                                elegido={es('despues', i, r.boton)} onElegir={() => onSel({ tipo: 'despues', i, boton: r.boton })} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    );
                })}
                <button type="button" className="lz-mas" onClick={onSumarPaso}><Plus aria-hidden="true" /> Paso</button>
            </div>
        </div>
    );
}
