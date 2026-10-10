import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ArrowLeft, ChevronRight, Pencil } from 'lucide-react';
import { fmt } from './Shared';
import useOpcionesDeReporte from '../../../components/feedback/useOpcionesDeReporte';
import Mascota from '../../../components/mascota/Mascota';
import { MASCOTAS, mascotaDe, nombreDeMascota } from '../../../components/mascota/mascotas';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { saveSession } from '../../../utils/sessionStore';

/**
 * La sesión al final del dock: quién está conectado y lo que no es una sección —crear algo, el
 * Playbook, cerrar sesión—. Antes eso eran botones sueltos en el header del mazo del closer, que
 * con el buscador no entraban en un renglón (pedido del 30/09/2026: "dejamos solamente el
 * buscador en la parte superior").
 *
 * El botón es el avatar con las iniciales. Si hay algo que mirar (los videos pendientes del
 * Playbook, las respuestas sin leer a tus reportes) lleva la cuenta encima, para que guardarlo en un
 * menú no lo esconda.
 *
 * «Reportar un problema» y «Mis reportes» (el botón flotante rosado de antes, desde el 07/10/2026) se
 * agregan solos a TODOS los menús, en el grupo previo al último (el de cerrar sesión): ningún dock
 * tiene que acordarse de ponerlos.
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
 *
 * Una opción con `panel: { titulo, cargar, vacio }` no corre nada: abre, en el mismo menú, una
 * lista que se pide al tocarla (`cargar` devuelve `[{ id, label, onClick }]`). Son "Simular a un
 * closer" y "Simular a un setter" de la dirección comercial: la lista de activos sale del backend en
 * ese momento.
 * Arriba de la lista va la vuelta al menú, que también es Escape o la flecha a la izquierda.
 *
 * El avatar es un personaje (page-mascot, ver `components/mascota`) que mira hacia el cursor; antes
 * eran las iniciales. Con el menú abierto, tocar el de la cabecera abre en el mismo menú los 10 para
 * elegir (pedido del 08/10/2026). Elegir lo cambia al instante —dock incluido— y lo guarda en la
 * cuenta (`PUT /auth/me/mascota`); si el guardado falla vuelve al anterior y lo dice. Mientras no
 * eligió, cada cuenta tiene uno fijo según su id. Simulando a otro no se elige (se ve el suyo).
 */
const MenuSesion = ({ nombre, rol, aviso = null, grupos }) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    // La opción cuyo panel está abierto y su lista: { estado: cargando | listo | error, opciones }.
    const [panel, setPanel] = useState(null);
    const [lista, setLista] = useState(null);
    // Cada pedido de lista lleva un número: la respuesta de uno viejo (se volvió al menú, se cerró,
    // se reintentó) no pisa lo que se está mostrando.
    const pedido = useRef(0);
    // Al volver de un panel, el foco va a la opción que lo abrió y no a la primera.
    const regreso = useRef(null);
    const boton = useRef(null);
    const menu = useRef(null);
    // La vista para elegir personaje, si falló el último guardado, y los toques de cada personaje
    // (cada uno reacciona cuando el suyo cambia).
    const [eligiendo, setEligiendo] = useState(false);
    const [noSeGuardo, setNoSeGuardo] = useState(false);
    const [toques, setToques] = useState({});
    const tocar = useCallback((clave) => setToques(t => ({ ...t, [clave]: (t[clave] || 0) + 1 })), []);

    const auth = useAuth();
    const usuario = auth?.user;
    const personaje = mascotaDe(usuario, nombre);
    const puedeElegir = !!usuario && !usuario.is_impersonating && typeof auth.setUser === 'function';

    const cerrar = useCallback((devolverFoco = false) => {
        pedido.current += 1;
        setAbierto(false);
        setPos(null);
        setPanel(null);
        setLista(null);
        setEligiendo(false);
        setNoSeGuardo(false);
        if (devolverFoco) boton.current?.focus();
    }, []);

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

    const volverAlMenu = useCallback(() => {
        pedido.current += 1;
        regreso.current = eligiendo ? 'mascota' : (panel?.id || null);
        setPanel(null);
        setLista(null);
        setEligiendo(false);
        setNoSeGuardo(false);
    }, [panel, eligiendo]);

    const fijarMascota = useCallback((mascota) => {
        auth.setUser((u) => {
            if (!u) return u;
            const nuevo = { ...u, mascota };
            saveSession(nuevo);
            return nuevo;
        });
    }, [auth]);

    const elegirMascota = (id) => {
        tocar(id);
        if (id === personaje) return;
        const anterior = usuario.mascota ?? null;
        setNoSeGuardo(false);
        fijarMascota(id);
        api.put('/auth/me/mascota', { mascota: id }).catch(() => {
            fijarMascota(anterior);
            setNoSeGuardo(true);
        });
    };

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
    // Tab o con las flechas tiene que funcionar sin el mouse. En un panel, a la primera de la lista
    // en cuanto llega (mientras carga, a la vuelta); al volver, a la opción que lo abrió.
    const estadoDeLista = lista?.estado;
    useEffect(() => {
        const m = menu.current;
        if (!abierto || !pos || !m) return;
        let destino;
        if (eligiendo) {
            destino = m.querySelector('[aria-checked="true"]') || m.querySelector('[data-volver]');
        } else if (panel) {
            destino = m.querySelector('[data-opcion]') || m.querySelector('[data-volver]');
        } else {
            destino = (regreso.current && m.querySelector(`[data-id="${regreso.current}"]`))
                || m.querySelector('[role="menuitem"]');
            regreso.current = null;
        }
        destino?.focus();
    }, [abierto, pos, panel, estadoDeLista, eligiendo]);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (menu.current?.contains(e.target) || boton.current?.contains(e.target)) return;
            cerrar();
        };
        const teclas = (e) => {
            if (e.key === 'Escape' || (e.key === 'ArrowLeft' && panel)) {
                e.preventDefault();
                if (panel || eligiendo) volverAlMenu();
                else cerrar(true);
                return;
            }
            // Entre los personajes (una grilla de 5) también se anda con izquierda y derecha.
            const adelante = e.key === 'ArrowDown' || (eligiendo && e.key === 'ArrowRight');
            const atras = e.key === 'ArrowUp' || (eligiendo && e.key === 'ArrowLeft');
            if (!adelante && !atras) return;
            const items = [...(menu.current?.querySelectorAll('[role^="menuitem"]') || [])];
            if (!items.length) return;
            e.preventDefault();
            const i = items.indexOf(document.activeElement);
            const paso = adelante ? 1 : -1;
            items[(i + paso + items.length) % items.length].focus();
        };
        document.addEventListener('pointerdown', afuera);
        document.addEventListener('keydown', teclas);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            document.removeEventListener('keydown', teclas);
        };
    }, [abierto, cerrar, panel, eligiendo, volverAlMenu]);

    const elegir = (op) => {
        if (op.panel) {
            abrirPanel(op);
            return;
        }
        flushSync(() => cerrar());
        op.onClick();
    };

    // Los reportes: sus opciones van antes del último grupo (cerrar sesión) y las respuestas sin leer
    // se suman a la cuenta del avatar.
    const reportes = useOpcionesDeReporte();
    const conGrupos = grupos.filter(g => g.length);
    const todosLosGrupos = [...conGrupos.slice(0, -1), reportes.opciones, ...conGrupos.slice(-1)];
    const enCuenta = (Number(aviso?.texto) || 0) + reportes.sinLeer;
    const cuenta = enCuenta > 0 ? enCuenta : aviso?.texto;
    const titulos = [aviso?.titulo, reportes.sinLeer ? `${reportes.sinLeer} ${reportes.sinLeer === 1 ? 'respuesta sin leer' : 'respuestas sin leer'} a tus reportes` : null];
    const etiqueta = [`Tu sesión: ${nombre}`, ...titulos].filter(Boolean).join(', ');

    return (
        <>
            <button ref={boton} type="button" className="dock-sesion" aria-label={etiqueta}
                title={etiqueta} aria-haspopup="menu" aria-expanded={abierto}
                onClick={() => { tocar('dock'); if (abierto) cerrar(); else setAbierto(true); }}>
                <Mascota personaje={personaje} size={50} toques={toques.dock} />
                {cuenta && <span className="dock-sesion-aviso" aria-hidden="true">{cuenta}</span>}
            </button>
            {abierto && createPortal(
                <div className="dc-shell menu-capa">
                    <div ref={menu} className="menu menu--sesion" role="menu" aria-label="Tu sesión"
                        style={pos
                            ? { left: pos.left, bottom: pos.bottom, maxHeight: pos.alto }
                            : { left: 0, bottom: 0, visibility: 'hidden' }}>
                        {eligiendo ? (
                            <div role="group" aria-label="Elegí tu personaje">
                                <button type="button" role="menuitem" data-volver=""
                                    className="menu-item menu-item--ico menu-volver"
                                    aria-label="Volver al menú. Elegí tu personaje" onClick={volverAlMenu}>
                                    <ArrowLeft size={16} aria-hidden="true" />
                                    <span className="trunc">Elegí tu personaje</span>
                                </button>
                                <hr className="menu-sep" />
                                <div className="menu-mascotas">
                                    {MASCOTAS.map((m, i) => (
                                        <button key={m.id} type="button" role="menuitemradio"
                                            aria-checked={m.id === personaje} aria-label={m.nombre} title={m.nombre}
                                            className="menu-mascota" style={{ '--i': i }}
                                            onClick={() => elegirMascota(m.id)}>
                                            <Mascota personaje={m.id} size={50} toques={toques[m.id]} />
                                        </button>
                                    ))}
                                </div>
                                {noSeGuardo && <p className="menu-nota" role="alert">No se pudo guardar. Probá de nuevo.</p>}
                            </div>
                        ) : panel ? (
                            <div role="group" aria-label={panel.panel.titulo} aria-busy={lista?.estado === 'cargando'}>
                                <button type="button" role="menuitem" data-volver=""
                                    className="menu-item menu-item--ico menu-volver"
                                    aria-label={`Volver al menú. ${panel.panel.titulo}`} onClick={volverAlMenu}>
                                    <ArrowLeft size={16} aria-hidden="true" />
                                    <span className="trunc">{panel.panel.titulo}</span>
                                </button>
                                <hr className="menu-sep" />
                                {lista?.estado === 'cargando' && <p className="menu-nota">Cargando…</p>}
                                {lista?.estado === 'error' && (
                                    <>
                                        <p className="menu-nota">No se pudo cargar la lista.</p>
                                        <button type="button" role="menuitem" data-opcion=""
                                            className="menu-item" onClick={() => abrirPanel(panel)}>
                                            Reintentar
                                        </button>
                                    </>
                                )}
                                {lista?.estado === 'listo' && !lista.opciones.length && (
                                    <p className="menu-nota">{panel.panel.vacio}</p>
                                )}
                                {lista?.estado === 'listo' && lista.opciones.map(o => (
                                    <button key={o.id} type="button" role="menuitem" data-opcion=""
                                        className="menu-item menu-item--ico"
                                        onClick={() => { flushSync(() => cerrar()); o.onClick(); }}>
                                        <span className="avatar avatar--chica" aria-hidden="true">{fmt.iniciales(o.label)}</span>
                                        <span className="trunc">{o.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="menu-quien">
                                    {puedeElegir ? (
                                        <button type="button" className="menu-quien-avatar" data-id="mascota"
                                            aria-label={`Cambiar tu personaje (ahora: ${nombreDeMascota(personaje)})`}
                                            title="Cambiar tu personaje"
                                            onClick={() => { tocar('cabecera'); setEligiendo(true); }}>
                                            <Mascota personaje={personaje} size={48} toques={toques.cabecera} />
                                            <span className="menu-quien-cambiar" aria-hidden="true"><Pencil size={9} strokeWidth={3} /></span>
                                        </button>
                                    ) : (
                                        <Mascota personaje={personaje} size={48} />
                                    )}
                                    <span className="menu-quien-txt">
                                        <b className="trunc">{nombre}</b>
                                        {rol && <small>{rol}</small>}
                                    </span>
                                </div>
                                {todosLosGrupos.map((grupo, i) => (
                                    <div key={grupo[0].id} role="group">
                                        {i > 0 && <hr className="menu-sep" />}
                                        {grupo.map(op => (
                                            <button key={op.id} type="button" role="menuitem" data-id={op.id}
                                                className={`menu-item menu-item--ico${op.peligro ? ' menu-item--peligro' : ''}`}
                                                aria-label={op.titulo ? `${op.label}, ${op.titulo}` : undefined}
                                                aria-haspopup={op.panel ? 'menu' : undefined}
                                                onClick={() => elegir(op)}>
                                                <op.Icono size={16} aria-hidden="true" />
                                                <span className="trunc">{op.label}</span>
                                                {op.cuenta != null && <span className="menu-cuenta">{op.cuenta}</span>}
                                                {op.pronto && <span className="dock-pronto">Pronto</span>}
                                                {op.panel && <ChevronRight size={15} aria-hidden="true" className="menu-flecha" />}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};

export default MenuSesion;
