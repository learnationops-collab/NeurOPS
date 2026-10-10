import React, { useRef, useState } from 'react';
import { reanimar } from './movimiento';

/**
 * La celda tipo volumen: se llena con el color del canal en la proporción de su número.
 *
 * Se carga de dos maneras, como en el diseño: arrastrando de costado (la celda se llena como un
 * volumen y el número sigue al dedo) o escribiendo (un clic sin arrastre deja escribir). Con las
 * flechas sube o baja de a uno, de a diez con Shift; Enter pasa al número siguiente y, en el
 * último, al paso siguiente (eso lo decide `onEnter`, que conoce el orden).
 *
 * `proporcion` es cuánto se llena (0 a 1) y `tope` hasta dónde llega un arrastre de punta a punta:
 * los dos los calcula el formulario contra la etapa anterior o contra los pares de la celda.
 */
export const idDeCelda = (ruta) => `rd-${ruta.replace(/\./g, '-')}`;

const Celda = ({ ruta, valor, color, proporcion, tope, marca, aria, indice = 0, onCambio, onEnter }) => {
    const cajaRef = useRef(null);
    const inputRef = useRef(null);
    const arrastre = useRef(null);
    // Mientras se arrastra, el relleno sigue al puntero y no a la cuenta: si el tope es chico la
    // cuenta salta de a un número y el relleno iría a los saltos.
    const [pArrastre, setPArrastre] = useState(null);

    const p = pArrastre ?? proporcion;

    const poner = (v, dir = 0) => {
        const limpio = Math.max(0, Math.min(99999, v));
        onCambio(ruta, limpio);
        if (dir && inputRef.current) {
            inputRef.current.style.setProperty('--dy', dir > 0 ? '-8px' : '8px');
            reanimar(inputRef.current, 'rd-bump');
        }
    };

    const alBajar = (e) => {
        if (e.button > 0) return;
        if (document.activeElement === inputRef.current && e.target === inputRef.current) return;
        e.preventDefault();
        arrastre.current = {
            x0: e.clientX, movido: false, tope, rect: cajaRef.current.getBoundingClientRect(), id: e.pointerId,
        };
        try { cajaRef.current.setPointerCapture(e.pointerId); } catch { /* sin captura, igual sigue */ }
    };

    const alMover = (e) => {
        const a = arrastre.current;
        if (!a || e.pointerId !== a.id) return;
        if (!a.movido) {
            if (Math.abs(e.clientX - a.x0) < 5) return;
            a.movido = true;
            inputRef.current?.blur();
        }
        const f = Math.max(0, Math.min(1, (e.clientX - a.rect.left) / (a.rect.width || 1)));
        setPArrastre(f);
        const v = Math.round(f * a.tope);
        if (v !== valor) poner(v);
    };

    const alSoltar = () => {
        const a = arrastre.current;
        if (!a) return;
        arrastre.current = null;
        setPArrastre(null);
        if (!a.movido) {
            inputRef.current?.focus({ preventScroll: true });
            inputRef.current?.select();
        }
    };

    const alTeclear = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
            poner(valor + d, d);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.(ruta, e.shiftKey);
        }
    };

    const clases = ['rd-tile', p === 0 && 'cero', pArrastre !== null && 'scrub',
        marca === 'warn' && 'is-warn', marca === 'err' && 'is-err'].filter(Boolean).join(' ');

    return (
        <div ref={cajaRef} className={clases} data-tile={ruta}
            style={{ '--c': color, '--p': p, '--i': indice }}
            onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
            <span className="rd-fill" aria-hidden="true" />
            <span className="rd-borde" aria-hidden="true" />
            <input ref={inputRef} className="rd-cv" id={idDeCelda(ruta)} data-ruta={ruta}
                inputMode="numeric" enterKeyHint="next" autoComplete="off" placeholder="0"
                aria-label={aria} aria-invalid={marca ? 'true' : 'false'}
                value={valor ? String(valor) : ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, '').slice(0, 5);
                    onCambio(ruta, limpio ? parseInt(limpio, 10) : 0);
                }}
                onKeyDown={alTeclear} />
        </div>
    );
};

export default Celda;
