import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { fmt } from './Shared';

/**
 * La sesión al final del dock: quién está conectado y lo que no es una sección —crear algo, el
 * Playbook, cerrar sesión—. Antes eso eran botones sueltos en el header del mazo del closer, que
 * con el buscador no entraban en un renglón (pedido del 30/09/2026: "dejamos solamente el
 * buscador en la parte superior").
 *
 * El botón es el avatar con las iniciales. Si hay algo que mirar (los videos pendientes del
 * Playbook) lleva la cuenta encima, para que guardarlo en un menú no lo esconda.
 *
 * El menú se dibuja en un portal colgado de `<body>`, como la burbuja de `Tip`: el dock tiene
 * `overflow` y `backdrop-filter`, y adentro un menú quedaría recortado (el `backdrop-filter` además
 * le cambia a qué se refiere un `position:fixed`). Abre hacia arriba, alineado al borde derecho del
 * botón y clavado dentro de la ventana. El nodo del portal lleva `dc-shell` para tener los tokens.
 *
 * `grupos` es una lista de listas de opciones `{ id, label, Icono, onClick, cuenta?, titulo?,
 * pronto?, peligro? }`; entre grupo y grupo va una línea. Elegir una opción cierra el menú antes de
 * correr la acción (`flushSync`: si no, React lo cerraba recién después, y el "¿Cerrar sesión?"
 * de `window.confirm` salía con el menú abierto detrás). Se cierra también con Escape (devuelve el
 * foco al botón) o tocando afuera.
 */
const MenuSesion = ({ nombre, rol, aviso = null, grupos }) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const boton = useRef(null);
    const menu = useRef(null);

    const cerrar = useCallback((devolverFoco = false) => {
        setAbierto(false);
        setPos(null);
        if (devolverFoco) boton.current?.focus();
    }, []);

    // Se mide después de dibujarlo (invisible) para saber su ancho y su alto reales.
    useLayoutEffect(() => {
        if (!abierto) return undefined;
        const medir = () => {
            const b = boton.current?.getBoundingClientRect();
            const m = menu.current;
            if (!b || !m) return;
            const margen = 16;
            const ancho = m.offsetWidth;
            const left = Math.min(Math.max(b.right - ancho, margen), window.innerWidth - ancho - margen);
            const bottom = window.innerHeight - b.top + 10;
            setPos({ left, bottom, alto: Math.max(160, b.top - 10 - margen) });
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [abierto]);

    // Con el menú ya ubicado, el foco va a la primera opción: abrir con el teclado y seguir con
    // Tab o con las flechas tiene que funcionar sin el mouse.
    useEffect(() => {
        if (abierto && pos) menu.current?.querySelector('[role="menuitem"]')?.focus();
    }, [abierto, pos]);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (menu.current?.contains(e.target) || boton.current?.contains(e.target)) return;
            cerrar();
        };
        const teclas = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); cerrar(true); return; }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const items = [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])];
            if (!items.length) return;
            e.preventDefault();
            const i = items.indexOf(document.activeElement);
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            items[(i + paso + items.length) % items.length].focus();
        };
        document.addEventListener('pointerdown', afuera);
        document.addEventListener('keydown', teclas);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            document.removeEventListener('keydown', teclas);
        };
    }, [abierto, cerrar]);

    const iniciales = fmt.iniciales(nombre);
    const etiqueta = [`Tu sesión: ${nombre}`, aviso?.titulo].filter(Boolean).join(', ');

    return (
        <>
            <button ref={boton} type="button" className="dock-sesion" aria-label={etiqueta}
                title={etiqueta} aria-haspopup="menu" aria-expanded={abierto}
                onClick={() => (abierto ? cerrar() : setAbierto(true))}>
                <span className="avatar" aria-hidden="true">{iniciales}</span>
                {aviso?.texto && <span className="dock-sesion-aviso" aria-hidden="true">{aviso.texto}</span>}
            </button>
            {abierto && createPortal(
                <div className="dc-shell menu-capa">
                    <div ref={menu} className="menu menu--sesion" role="menu" aria-label="Tu sesión"
                        style={pos
                            ? { left: pos.left, bottom: pos.bottom, maxHeight: pos.alto }
                            : { left: 0, bottom: 0, visibility: 'hidden' }}>
                        <div className="menu-quien">
                            <span className="avatar" aria-hidden="true">{iniciales}</span>
                            <span className="menu-quien-txt">
                                <b className="trunc">{nombre}</b>
                                {rol && <small>{rol}</small>}
                            </span>
                        </div>
                        {grupos.filter(g => g.length).map((grupo, i) => (
                            <div key={grupo[0].id} role="group">
                                {i > 0 && <hr className="menu-sep" />}
                                {grupo.map(op => (
                                    <button key={op.id} type="button" role="menuitem"
                                        className={`menu-item menu-item--ico${op.peligro ? ' menu-item--peligro' : ''}`}
                                        aria-label={op.titulo ? `${op.label}, ${op.titulo}` : undefined}
                                        onClick={() => { flushSync(() => cerrar()); op.onClick(); }}>
                                        <op.Icono size={16} aria-hidden="true" />
                                        <span className="trunc">{op.label}</span>
                                        {op.cuenta != null && <span className="menu-cuenta">{op.cuenta}</span>}
                                        {op.pronto && <span className="dock-pronto">Pronto</span>}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};

export default MenuSesion;
