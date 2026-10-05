// Piezas chicas que comparten la lista, el editor y el ruteo de Forms.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { almacen } from '../../data/hooks';
import { ord } from '../../core/datos';
import { clonar } from '../../core/util';
import { ui } from '../../ui/estadoUi';

// Color de cada prioridad según su lugar: 1 magenta, 2 ámbar, 3 azul, 4 verde, el resto gris.
export function colorNivel(n) {
    return ['var(--brand-secondary)', 'var(--warning)', 'var(--info)', 'var(--success)', 'var(--idle)'][Math.max(0, Math.min(4, n - 1))];
}

// Opciones del desplegable de prioridad (las mismas en reglas y en "Todo lo demás").
export function opcionesPrioridad(d) {
    return [{ v: '', n: 'Elegí prioridad', icono: 'rayo', color: 'var(--idle)' }]
        .concat(ord(d, 'grupos').map((g, i) => ({ v: g.id, n: (i + 1) + ' · ' + g.nombre, icono: 'estrella', color: colorNivel(i + 1) })));
}

// Título de una pregunta con {nombre} pintado como ficha.
export function TituloConToken({ t }) {
    t = String(t || '');
    if (!t.trim()) return <span className="mut40">Pregunta sin escribir</span>;
    const partes = t.split(/\{nombre\}/gi);
    return partes.map((p, i) => (
        <React.Fragment key={i}>{p}{i < partes.length - 1 && <span className="token">nombre</span>}</React.Fragment>
    ));
}

// Cambia un campo del formulario a partir de su valor más reciente en el almacén.
// fn recibe una copia (se puede mutar) y puede devolver un valor nuevo.
export function mutarForm(id, campo, fn) {
    const f = almacen.buscar('formularios', id);
    if (!f) return;
    const x = clonar(f[campo]);
    const r = fn(x);
    almacen.editar('formularios', id, { [campo]: r === undefined ? x : r });
}

// Estado del editor guardado en la interfaz (pregunta abierta, multiselección abierta, modo del ruteo).
export function setFormUi(parcial) {
    const f = ui.getState().form;
    if (f) ui.set({ form: { ...f, ...parcial } });
}

// Enfocar algo después del próximo render (el elemento todavía no existe cuando se pide).
// enfocar('#id') o enfocar('#id', [desde, hasta]) para dejar el cursor en un lugar.
export function useEnfocar(raiz) {
    const pend = useRef(null);
    const [, tic] = useState(0);
    useEffect(() => {
        const p = pend.current;
        if (!p || !raiz.current) return;
        pend.current = null;
        const el = raiz.current.querySelector(p.sel) || (p.alt && raiz.current.querySelector(p.alt));
        if (!el) return;
        el.focus({ preventScroll: true });
        if (p.rango && el.setSelectionRange) try { el.setSelectionRange(p.rango[0], p.rango[1]); } catch { /* no es campo de texto */ }
    });
    return useCallback((sel, rango, alt) => { pend.current = { sel, rango, alt }; tic(n => n + 1); }, []);
}

// Campo de texto con borrador propio: el almacén normaliza (un nombre vacío pasa a "Sin nombre"),
// así que mientras se escribe se muestra lo tecleado y se toma lo guardado al salir.
export function useBorrador(valor, guardar) {
    const [txt, setTxt] = useState(valor);
    const editando = useRef(false);
    useEffect(() => { if (!editando.current) setTxt(valor); }, [valor]);
    return {
        value: txt,
        onChange: (e) => { editando.current = true; setTxt(e.target.value); guardar(e.target.value); },
        onFocus: () => { editando.current = true; },
        onBlur: () => { editando.current = false; setTxt(valor); },
    };
}
