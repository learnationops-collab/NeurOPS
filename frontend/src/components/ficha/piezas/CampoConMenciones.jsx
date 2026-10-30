// Campo de una línea con «@»: al escribir @ se abre la lista del equipo, se filtra con lo que sigue y se elige
// con el mouse o con ↑ ↓ Enter. Lo elegido queda como «@Nombre» en el texto y se avisa a `onElegir`; quien
// escribe decide a quién avisar nombrándolo, sin una fila aparte de botones. Enter envía si no hay lista.

import { useEffect, useRef, useState } from 'react';
import { insertar, plano } from '../../../pages/copiloto/menciones';

const ARROBA = /(?:^|\s)@([^@\n[\]]{0,40})$/;
const MAXIMO = 6;

/** El «@algo» que se está escribiendo antes del cursor (hasta cuatro palabras); null si no hay. */
const arrobaAntesDe = (valor, cursor) => {
    const m = (valor || '').slice(0, cursor).match(ARROBA);
    if (!m || m[1].trim().split(/\s+/).filter(Boolean).length > 4) return null;
    return { inicio: cursor - m[1].length - 1, fin: cursor, termino: m[1].trim() };
};

export default function CampoConMenciones({ value, onChange, onEnviar, equipo = [], onElegir, placeholder, ariaLabel }) {
    const campo = useRef(null);
    const [cursor, setCursor] = useState(0);
    const [indice, setIndice] = useState(0);
    const [cerrado, setCerrado] = useState(false);

    const rango = cerrado ? null : arrobaAntesDe(value, cursor);
    const opciones = rango ? equipo.filter((p) => plano(p.nombre).includes(plano(rango.termino))).slice(0, MAXIMO) : [];
    useEffect(() => { setIndice(0); }, [rango?.termino]);

    const elegir = (persona) => {
        const { valor, cursor: nuevo } = insertar(value, rango, { tipo: 'arroba', nombre: persona.nombre });
        onChange(valor);
        onElegir?.(persona);
        setCursor(nuevo);
        requestAnimationFrame(() => { campo.current?.focus(); campo.current?.setSelectionRange(nuevo, nuevo); });
    };

    const alTeclear = (e) => {
        if (opciones.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIndice((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(opciones[indice]); return; }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setCerrado(true); return; }
        }
        if (e.key === 'Enter') { e.preventDefault(); onEnviar?.(); }
    };

    return (
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--s2)' }}>
            {/* En el flujo, no flotando: el cuerpo de la ficha corta lo que se sale por arriba (11/2026). */}
            {opciones.length > 0 && (
                <div role="listbox" aria-label="Avisar a"
                    style={{ display: 'grid', gap: 2, padding: 'var(--s2)', maxHeight: 176, overflowY: 'auto',
                        background: 'var(--bg-flotante)', border: '1px solid var(--border-control)', borderRadius: 'var(--radius-control)' }}>
                    {opciones.map((p, i) => (
                        <button key={p.id} type="button" role="option" className="fi-opcion" aria-selected={i === indice}
                            onMouseDown={(e) => { e.preventDefault(); elegir(p); }}>
                            <span>{p.nombre}</span>
                            <span className="t-cap mut">{p.rol}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="entrada" style={{ height: 48 }}>
                <input ref={campo} value={value} aria-label={ariaLabel} placeholder={placeholder}
                    onChange={(e) => { onChange(e.target.value); setCursor(e.target.selectionStart); setCerrado(false); }}
                    onSelect={(e) => setCursor(e.target.selectionStart)}
                    onKeyDown={alTeclear} />
            </div>
        </div>
    );
}
