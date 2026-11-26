// «Herramientas» en la isla derecha del dock (Dock 2.0, como el de Leadership y la llave de la Academia):
// TODO lo que no es una sección. Las herramientas en ventana del rol y «Nuevo», las acciones de la
// pantalla, lo de tu cuenta (Portal, avisos, reportes, cerrar sesión) y las secciones ocultas, cada una
// con su 📌 para fijarla a la izquierda. Al pie, «Editar navegación». El avatar solo abre Configuración.
//
// Se abre en una ventana centrada con lugar para todo (no en un menú pegado al botón, que no tenía espacio),
// con un buscador arriba y los grupos en columnas. Una lista fijada en el dock (`panelInicial`) sigue
// abriendo un menú chico al lado de su botón.
//
// Una opción con `panel: { titulo, cargar, vacio }` abre su lista en la misma ventana (Nuevo, Mis links):
// `cargar` devuelve (o promete) `[{ id, label, Icono?, onClick }]`. Fijada en el dock, el botón abre
// directo esa lista (`panelInicial`).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ArrowLeft, ArrowUpRight, ChevronRight, Lock, Pencil, Pin, PinOff, Search, Wrench, X } from 'lucide-react';
import { subirACapa } from '../components/standard/capa';
import { esFijable, tienePendientes, useFijadas } from '../sesion/fijadas';
import { conFicha } from './catalogoHerramientas';
import './herramientasModal.css';

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
            {tienePendientes(op) ? (
                // Con pendientes queda fijada hasta resolverse (ADR-W242): el pin no se puede sacar.
                <span className="menu-accion menu-fijar menu-fijar--candado" role="img" title="Se queda fijada hasta que la resuelvas"
                    aria-label={`${op.label}: fijada hasta que la resuelvas`}>
                    <Lock size={14} aria-hidden="true" />
                </span>
            ) : onFijar && (
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
    pista = 'Fijá lo que más usás: va a la izquierda del dock', clase = '', cuenta = null, panelInicial = null, principal = false }) {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const [panel, setPanel] = useState(null);
    const [lista, setLista] = useState(null);
    const [filtro, setFiltro] = useState('');
    const pedido = useRef(0);
    const velo = useRef(null);
    const buscador = useRef(null);
    // La de Herramientas es una ventana; la de una lista fijada, un menú al lado de su botón.
    const enVentana = !panelInicial;
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
        setAbierto(false); setPos(null); setPanel(null); setLista(null); setFiltro('');
    }, []);
    const abrir = () => { setAbierto(true); if (panelInicial) abrirPanel(panelInicial); };
    // La llave del dock se abre también con Ctrl+J (DockSecciones avisa con 'abrir-herramientas').
    useEffect(() => {
        if (!principal) return undefined;
        const alPedir = () => setAbierto(true);
        window.addEventListener('abrir-herramientas', alPedir);
        return () => window.removeEventListener('abrir-herramientas', alPedir);
    }, [principal]);

    useLayoutEffect(() => {
        if (!abierto) return undefined;
        if (enVentana) {
            subirACapa(velo.current);
            buscador.current?.focus();
            return undefined;
        }
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
    }, [abierto, enVentana]);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (menu.current?.contains(e.target) || boton.current?.contains(e.target)) return;
            cerrar();
        };
        const tecla = (e) => {
            if (e.key !== 'Escape') return;
            if (panel && !panelInicial) { setPanel(null); setLista(null); return; }
            if (filtro) { setFiltro(''); return; }
            cerrar(); boton.current?.focus();
        };
        document.addEventListener('pointerdown', afuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto, cerrar, panel, panelInicial, filtro]);

    const correr = (fn) => { flushSync(() => cerrar()); fn?.(); };
    const elegir = (op) => (op.panel ? abrirPanel(op) : correr(op.onClick));
    // El buscador filtra por nombre y por la línea de para qué sirve, sin importar tildes ni mayúsculas.
    const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = plano(filtro.trim());
    const conAlgo = grupos
        .map((g) => ({ ...g, opciones: q ? g.opciones.filter((op) => plano(`${op.label} ${op.desc ?? op.titulo ?? ''}`).includes(q)) : g.opciones }))
        .filter((g) => g.opciones.length);

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

    const grillaGrupos = conAlgo.map((g) => (
        <div key={g.titulo} role="group" aria-label={g.titulo} className="herr-grupo">
            <p className="menu-grupo">{g.titulo}</p>
            <div className="menu-herr-grid">
                {g.opciones.map((op) => (
                    <Fila key={op.id} op={op} fijada={fijadas.includes(op.id)} onAbrir={() => elegir(op)}
                        onFijar={usuario && esFijable(op) ? () => alternar(op.id) : null} />
                ))}
            </div>
        </div>
    ));

    const ventana = (
        <div ref={velo} className="dc-shell herr-velo">
            <div className="herr-fondo" aria-hidden="true" />
            <div ref={menu} className="herr-modal" role="dialog" aria-modal="true" aria-label={rotulo}>
                <header className="herr-cab">
                    <span className="herr-tit"><Icono size={18} aria-hidden="true" /><b>{panel ? panel.panel.titulo : rotulo}</b></span>
                    {!panel && (
                        <label className="herr-buscar">
                            <Search size={15} aria-hidden="true" />
                            <input ref={buscador} type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                                placeholder="Buscar una herramienta" aria-label="Buscar una herramienta" />
                        </label>
                    )}
                    <button type="button" className="herr-cerrar" onClick={cerrar} aria-label="Cerrar" title="Cerrar · Esc"><X size={16} aria-hidden="true" /></button>
                </header>
                <div className="herr-cuerpo" role="menu" aria-label={rotulo}>
                    {vistaPanel || (conAlgo.length ? <div className="herr-grupos">{grillaGrupos}</div>
                        : <p className="menu-nota">Nada coincide con «{filtro}».</p>)}
                </div>
                {!panel && (
                    <footer className="herr-pie">
                        {pista && <small><Pin size={12} aria-hidden="true" /> {pista}</small>}
                        {onEditar && (
                            <button type="button" className="menu-item menu-item--ico herr-editar" onClick={() => correr(onEditar)}>
                                <Pencil size={15} aria-hidden="true" /><span>Editar navegación</span>
                            </button>
                        )}
                    </footer>
                )}
            </div>
        </div>
    );

    return (
        <>
            <button ref={boton} type="button" className={`dock-fijada ${clase}`.trim()} aria-label={rotulo}
                data-dock-tip={principal ? `${rotulo}|Todo lo que no es una sección: buscar, crear, agendas, avisos · Ctrl+J` : `${rotulo}|${panelInicial ? conFicha(panelInicial).desc : ''}`}
                aria-haspopup={enVentana ? "dialog" : "menu"} aria-expanded={abierto} onClick={() => (abierto ? cerrar() : abrir())}>
                <Icono size={19} aria-hidden="true" />
                <span className="dock-fijada-nombre">{rotulo}</span>
                {cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{cuenta}</span>}
            </button>
            {abierto && enVentana && createPortal(ventana, document.body)}
            {abierto && !enVentana && createPortal(
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
