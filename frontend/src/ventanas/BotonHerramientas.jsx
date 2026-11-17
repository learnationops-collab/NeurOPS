// «Herramientas» en la isla derecha del dock (Dock 2.0, como el de Leadership y la llave de la Academia):
// las herramientas en ventana del rol, las acciones de la pantalla (Learnito, Nueva agenda…) y las
// secciones ocultas, cada una con su 📌 para fijarla a la izquierda. Al pie, «Editar navegación».
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Pencil, Pin, PinOff, Wrench } from 'lucide-react';
import { subirACapa } from '../components/standard/capa';
import { useFijadas } from '../sesion/fijadas';

const Fila = ({ op, fijada, onAbrir, onFijar }) => {
    const rotulo = fijada ? `Quitar ${op.label} del dock` : `Fijar ${op.label} en el dock`;
    return (
        <div className="menu-fila">
            <button type="button" role="menuitem" className="menu-item menu-item--ico menu-item--herr" onClick={onAbrir}>
                <op.Icono size={16} aria-hidden="true" />
                <span className="menu-herr-tx"><b className="trunc">{op.label}</b>{op.titulo && <small className="trunc">{op.titulo}</small>}</span>
                {op.cuenta != null && <span className="menu-cuenta">{op.cuenta}</span>}
            </button>
            <button type="button" role="menuitemcheckbox" data-fijar="" aria-checked={fijada} aria-label={rotulo} title={rotulo}
                className={`menu-accion menu-fijar${fijada ? ' menu-fijar--puesta' : ''}`} onClick={onFijar}>
                {fijada ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
            </button>
        </div>
    );
};

/**
 * `grupos`: [{ titulo, opciones: [{ id, label, titulo?, Icono, onClick }] }]. Los vacíos no se ven.
 * Sirve también para «Nuevo» (isla izquierda): otro `Icono`, `rotulo` y `pista`, y `clase` para el botón.
 */
export default function BotonHerramientas({ usuario, grupos, onEditar = null, Icono = Wrench, rotulo = 'Herramientas',
    pista = 'Fijá lo que más usás: va a la izquierda del dock', clase = '' }) {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const boton = useRef(null);
    const menu = useRef(null);
    const { fijadas, alternar } = useFijadas(usuario);
    const cerrar = useCallback(() => { setAbierto(false); setPos(null); }, []);

    useLayoutEffect(() => {
        if (!abierto) return undefined;
        const medir = () => {
            const b = boton.current?.getBoundingClientRect();
            const m = menu.current;
            if (!b || !m) return;
            subirACapa(m);
            const margen = 16;
            const ancho = m.offsetWidth;
            const left = Math.min(Math.max(b.right - ancho, margen), window.innerWidth - ancho - margen);
            setPos({ left, bottom: window.innerHeight - b.top + 10, alto: Math.max(160, b.top - 10 - margen) });
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [abierto]);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (menu.current?.contains(e.target) || boton.current?.contains(e.target)) return;
            cerrar();
        };
        const tecla = (e) => { if (e.key === 'Escape') { cerrar(); boton.current?.focus(); } };
        document.addEventListener('pointerdown', afuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto, cerrar]);

    const correr = (fn) => { flushSync(() => cerrar()); fn(); };
    const conAlgo = grupos.filter((g) => g.opciones.length);

    return (
        <>
            <button ref={boton} type="button" className={`dock-fijada ${clase}`.trim()} aria-label={rotulo} title={rotulo}
                aria-haspopup="menu" aria-expanded={abierto} onClick={() => (abierto ? cerrar() : setAbierto(true))}>
                <Icono size={19} aria-hidden="true" />
            </button>
            {abierto && createPortal(
                <div className="dc-shell menu-capa">
                    <div ref={menu} className="menu menu--sesion menu--herr" role="menu" aria-label={rotulo}
                        style={pos ? { left: pos.left, bottom: pos.bottom, maxHeight: pos.alto } : { left: 0, bottom: 0, visibility: 'hidden' }}>
                        <div className="menu-herr-cab">
                            <b>{rotulo}</b>
                            {pista && <small><Pin size={11} aria-hidden="true" /> {pista}</small>}
                        </div>
                        {conAlgo.map((g) => (
                            <div key={g.titulo} role="group" aria-label={g.titulo}>
                                <p className="menu-grupo">{g.titulo}</p>
                                {g.opciones.map((op) => (
                                    <Fila key={op.id} op={op} fijada={fijadas.includes(op.id)}
                                        onAbrir={() => correr(op.onClick)} onFijar={() => alternar(op.id)} />
                                ))}
                            </div>
                        ))}
                        {onEditar && (
                            <>
                                <hr className="menu-sep" />
                                <button type="button" role="menuitem" className="menu-item menu-item--ico" onClick={() => correr(onEditar)}>
                                    <Pencil size={16} aria-hidden="true" />
                                    <span className="trunc">Editar navegación</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
