// Reordenar una lista arrastrando la manija (o con las flechas del teclado sobre ella).
// Uso:
//   const ord = useOrdenable(ids, nuevosIds => guardar(nuevosIds), {horizontal});
//   <div ref={ord.contenedor}>{ord.lista.map(id => <div {...ord.item(id)}><button {...ord.grip(id)} className="grip">…</button></div>)}</div>
// Sin useRef a propósito: el contenedor vive en el estado (ref de función) y lo que cambia durante
// un arrastre vive dentro del efecto, así nada del render lee un ref.

import { useEffect, useState } from 'react';

export function useOrdenable(ids, onReordenar, { horizontal = false } = {}) {
    const [cont, setCont] = useState(null);
    const [arrastre, setArrastre] = useState(null);   // {id, orden} al empezar a arrastrar
    const [temp, setTemp] = useState(null);           // orden provisorio mientras se arrastra
    const lista = temp || ids;

    useEffect(() => {
        if (!arrastre || !cont) return;
        const d = { id: arrastre.id, orden: arrastre.orden, movio: false };
        const raiz = document.querySelector('.thalamus-app');
        raiz?.classList.add('arrastre');
        const mover = (e) => {
            const hermanos = [...cont.querySelectorAll(':scope > [data-item]')].filter(c => c.dataset.item !== d.id);
            let antes = null;
            for (const h of hermanos) {
                const r = h.getBoundingClientRect();
                const pasa = horizontal ? (e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2)) : e.clientY < r.top + r.height / 2;
                if (pasa) { antes = h.dataset.item; break; }
            }
            const resto = d.orden.filter(x => x !== d.id);
            const i = antes ? resto.indexOf(antes) : resto.length;
            const nuevo = [...resto.slice(0, i), d.id, ...resto.slice(i)];
            if (nuevo.join('|') !== d.orden.join('|')) { d.orden = nuevo; d.movio = true; setTemp(nuevo); }
        };
        const fin = () => {
            setArrastre(null); setTemp(null);
            if (d.movio) onReordenar(d.orden, d.id);
        };
        document.addEventListener('pointermove', mover);
        document.addEventListener('pointerup', fin);
        document.addEventListener('pointercancel', fin);
        return () => {
            raiz?.classList.remove('arrastre');
            document.removeEventListener('pointermove', mover);
            document.removeEventListener('pointerup', fin);
            document.removeEventListener('pointercancel', fin);
        };
    }, [arrastre, cont, horizontal, onReordenar]);

    const arrastrado = arrastre ? arrastre.id : null;
    return {
        contenedor: setCont,
        lista,
        arrastrando: arrastrado,
        item: (id) => ({ 'data-item': id, key: id }),
        claseItem: (id) => (arrastrado === id ? ' arrastrando' : ''),
        grip: (id, label = 'Mover') => ({
            'data-grip-id': id,
            'aria-label': label,
            title: 'Arrastrá para ordenar',
            onPointerDown: (e) => {
                if (e.button > 0) return;
                e.preventDefault();
                setArrastre({ id, orden: ids.slice() });
            },
            onKeyDown: (e) => {
                const atras = horizontal ? ['ArrowLeft', 'ArrowUp'] : ['ArrowUp'];
                const adelante = horizontal ? ['ArrowRight', 'ArrowDown'] : ['ArrowDown'];
                const delta = atras.includes(e.key) ? -1 : adelante.includes(e.key) ? 1 : 0;
                if (!delta) return;
                e.preventDefault();
                const i = ids.indexOf(id), j = i + delta;
                if (j < 0 || j >= ids.length) return;
                const n = ids.slice(); n.splice(j, 0, n.splice(i, 1)[0]);
                onReordenar(n, id);
                // Después del nuevo render, la manija del que se movió sigue con el foco.
                requestAnimationFrame(() => {
                    const g = cont && cont.querySelector('[data-grip-id="' + CSS.escape(id) + '"]');
                    if (g) g.focus({ preventScroll: true });
                });
            },
        }),
    };
}
