// «Herramientas» en la isla derecha del dock (Dock 2.0, como el de Leadership y la llave de la Academia):
// TODO lo que no es una sección. Las herramientas en ventana del rol y «Nuevo», las acciones de la
// pantalla, lo de tu cuenta (Portal, avisos, reportes, cerrar sesión) y las secciones ocultas, cada una
// con su 📌 para fijarla a la izquierda. Al pie, «Editar navegación». El avatar solo abre Configuración.
//
// Una opción con `panel: { titulo, cargar, vacio }` abre su lista en el mismo menú (Nuevo, Mis links):
// `cargar` devuelve (o promete) `[{ id, label, Icono?, onClick }]`. Fijada en el dock, el botón abre
// directo esa lista (`panelInicial`).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ArrowLeft, ArrowUpRight, ChevronRight, Pencil, Pin, PinOff, Wrench } from 'lucide-react';
import { subirACapa } from '../components/standard/capa';
import { esFijable, useFijadas } from '../sesion/fijadas';

const Fila = ({ op, fijada, onAbrir, onFijar }) => {
    const rotulo = fijada ? `Quitar ${op.label} del dock` : `Fijar ${op.label} en el dock`;
    return (
        <div className="menu-fila">
            <button type="button" role="menuitem" aria-haspopup={op.panel ? 'menu' : undefined}
                className={`menu-item menu-item--ico menu-item--herr${op.peligro ? ' menu-item--peligro' : ''}`} onClick={onAbrir}
                style={{ '--c': `var(--herr-${op.color || 'gris'})` }}>
                <span className="menu-herr-ico"><op.Icono size={16} aria-hidden="true" /></span>
                <span className="menu-herr-tx"><b className="trunc">{op.label}</b>{(op.desc ?? op.titulo) && <small className="trunc">{op.desc ?? op.titulo}</small>}</span>
                {op.cuenta != null && <span className="menu-cuenta">{op.cuenta}</span>}
                {op.panel && <ChevronRight size={15} aria-hidden="true" className="menu-flecha" />}
                {op.va && <ArrowUpRight size={13} aria-hidden="true" className="menu-flecha" />}
            </button>
            {onFijar && (
                <button type="button" role="menuitemcheckbox" data-fijar="" aria-checked={fijada} aria-label={rotulo} title={rotulo}
                    className={`menu-accion menu-fijar${fijada ? ' menu-fijar--puesta' : ''}`} onClick={onFijar}>
                    {fijada ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
                </button>
            )}
        </div>
    );
};

/**
 * `grupos`: [{ titulo, opciones }]. Los vacíos no se ven. `cuenta`: el globito del botón (lo sin leer).
 * Con `panelInicial` es el botón de una lista fijada: abre directo esa lista, sin volver al menú.
 */
export default function BotonHerramientas({ usuario, grupos = [], onEditar = null, Icono = Wrench, rotulo = 'Herramientas',
    pista = 'Fijá lo que más usás: va a la izquierda del dock', clase = '', cuenta = null, panelInicial = null }) {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const [panel, setPanel] = useState(null);
    const [lista, setLista] = useState(null);
    const pedido = useRef(0);
    const boton = useRef(null);
    const menu = useRef(null);
    const { fijadas, alternar } = useFijadas(usuario);

    const abrirPanel = useCallback((op) => {
        pedido.current += 1;
        const n = pedido.current;
        setPanel(op);
        setLista({ estado: 'cargando', opciones: [] });
        Promise.resolve().then(op.panel.cargar).then(
            (opciones) => { if (pedido.current === n) setLista({ estado: 'listo', opciones: opciones || [] }); },
            () => { if (pedido.current === n) setLista({ estado: 'error', opciones: [] }); },
        );
    }, []);
    const cerrar = useCallback(() => {
        pedido.current += 1;
        setAbierto(false); setPos(null); setPanel(null); setLista(null);
    }, []);
    const abrir = () => { setAbierto(true); if (panelInicial) abrirPanel(panelInicial); };

    useLayoutEffect(() => {
        if (!abierto) return undefined;
        const medir = () => {
            const b = boton.current?.getBoundingClientRect();
            const m = menu.current;
            if (!b || !m) return;
            subirACapa(m);
            const margen = 16;
            const ancho = m.offsetWidth;
            // En la barra lateral abre a la derecha del botón, hacia abajo; en el dock, arriba.
            if (boton.current.closest('.dock-lado')) {
                const top = Math.max(margen, Math.min(b.top, window.innerHeight - margen - 240));
                setPos({ left: b.right + 12, top, alto: window.innerHeight - top - margen });
                return;
            }
            const left = Math.min(Math.max(b.left + b.width / 2 - ancho / 2, margen), window.innerWidth - ancho - margen);
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
        const tecla = (e) => {
            if (e.key !== 'Escape') return;
            if (panel && !panelInicial) { setPanel(null); setLista(null); return; }
            cerrar(); boton.current?.focus();
        };
        document.addEventListener('pointerdown', afuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto, cerrar, panel, panelInicial]);

    const correr = (fn) => { flushSync(() => cerrar()); fn?.(); };
    const elegir = (op) => (op.panel ? abrirPanel(op) : correr(op.onClick));
    const conAlgo = grupos.filter((g) => g.opciones.length);

    const vistaPanel = panel && (
        <div role="group" aria-label={panel.panel.titulo} aria-busy={lista?.estado === 'cargando'}>
            {panelInicial ? (
                <div className="menu-herr-cab"><b>{panel.panel.titulo}</b></div>
            ) : (
                <button type="button" role="menuitem" className="menu-item menu-item--ico menu-volver"
                    aria-label={`Volver. ${panel.panel.titulo}`} onClick={() => { setPanel(null); setLista(null); }}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span className="trunc">{panel.panel.titulo}</span>
                </button>
            )}
            <hr className="menu-sep" />
            {lista?.estado === 'cargando' && <p className="menu-nota">Cargando…</p>}
            {lista?.estado === 'error' && (
                <>
                    <p className="menu-nota">No se pudo cargar la lista.</p>
                    <button type="button" role="menuitem" className="menu-item" onClick={() => abrirPanel(panel)}>Reintentar</button>
                </>
            )}
            {lista?.estado === 'listo' && !lista.opciones.length && <p className="menu-nota">{panel.panel.vacio}</p>}
            {lista?.estado === 'listo' && lista.opciones.map((o) => (
                <button key={o.id} type="button" role="menuitem" className="menu-item menu-item--ico" onClick={() => correr(o.onClick)}>
                    {o.Icono && <o.Icono size={16} aria-hidden="true" />}
                    <span className="trunc">{o.label}</span>
                </button>
            ))}
        </div>
    );

    return (
        <>
            <button ref={boton} type="button" className={`dock-fijada ${clase}`.trim()} aria-label={rotulo} title={rotulo}
                aria-haspopup="menu" aria-expanded={abierto} onClick={() => (abierto ? cerrar() : abrir())}>
                <Icono size={19} aria-hidden="true" />
                {cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{cuenta}</span>}
            </button>
            {abierto && createPortal(
                <div className="dc-shell menu-capa">
                    <div ref={menu} className="menu menu--sesion menu--herr" role="menu" aria-label={rotulo}
                        style={pos
                            ? { left: pos.left, ...(pos.top != null ? { top: pos.top, bottom: 'auto' } : { bottom: pos.bottom }), maxHeight: pos.alto }
                            : { left: 0, bottom: 0, visibility: 'hidden' }}>
                        {vistaPanel || (
                            <>
                                <div className="menu-herr-cab">
                                    <b>{rotulo}</b>
                                    {pista && <small><Pin size={11} aria-hidden="true" /> {pista}</small>}
                                </div>
                                {conAlgo.map((g) => (
                                    <div key={g.titulo} role="group" aria-label={g.titulo}>
                                        <p className="menu-grupo">{g.titulo}</p>
                                        <div className="menu-herr-grid">
                                            {g.opciones.map((op) => (
                                                <Fila key={op.id} op={op} fijada={fijadas.includes(op.id)} onAbrir={() => elegir(op)}
                                                    onFijar={usuario && esFijable(op) ? () => alternar(op.id) : null} />
                                            ))}
                                        </div>
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
                            </>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
