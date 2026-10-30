// Desplegables apilados (acordeón): la lista de bloques es un array de datos; agregar o quitar un bloque es
// sumar o sacar un item. Cada item se abre y se cierra solo (`multiple`) o deja uno abierto a la vez.

import { useId, useState } from 'react';
import clsx from 'clsx';
import './standard.css';

/**
 * items: [{ key, title, meta?, color?, children, open? }]. `meta` es lo que se ve con el item cerrado (cifras sueltas:
 * va dentro del botón, así que sin botones ni links). `children` puede ser una función: solo se llama con el item abierto.
 * `color` pone un punto delante del título. `open`: abierto al principio (sin `value`).
 * Controlado: `value` (las keys abiertas) + `onChange(keys, key)`; así la pantalla recuerda qué dejó abierto.
 */
export function Accordion({ items, value, onChange, multiple = true, className, ...rest }) {
    const base = useId();
    const [propio, setPropio] = useState(() => items.filter((i) => i.open).map((i) => i.key));
    const abiertos = value ?? propio;
    const alternar = (key) => {
        const abre = !abiertos.includes(key);
        const sig = abre ? (multiple ? [...abiertos, key] : [key]) : abiertos.filter((k) => k !== key);
        if (value === undefined) setPropio(sig);
        if (onChange) onChange(sig, key);
    };
    return (
        <div className={clsx('ui-acc', className)} {...rest}>
            {items.map((it) => {
                const abierto = abiertos.includes(it.key);
                const id = `${base}-${it.key}`;
                return (
                    <section key={it.key} className={clsx('ui-acc__item', abierto && 'ui-acc__item--open')}>
                        <div role="heading" aria-level={3} className="ui-acc__head">
                            <button type="button" className="ui-acc__btn" aria-expanded={abierto} aria-controls={id} onClick={() => alternar(it.key)}>
                                <svg className="ui-acc__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75"
                                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                                {it.color && <i className="ui-acc__dot" style={{ background: it.color }} aria-hidden="true" />}
                                <span className="ui-acc__title">{it.title}</span>
                                {it.meta && <span className="ui-acc__meta">{it.meta}</span>}
                            </button>
                        </div>
                        {abierto && (
                            <div id={id} className="ui-acc__body">
                                {typeof it.children === 'function' ? it.children() : it.children}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
