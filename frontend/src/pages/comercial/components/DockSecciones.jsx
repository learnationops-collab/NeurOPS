import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Humo } from './Shared';
import { DockContexto } from './dockContexto';
import DockFijadas from './DockFijadas';
import DockTip from './DockTip';
import IslaVentanas from '../../../ventanas/IslaVentanas';
import BotonHerramientas from '../../../ventanas/BotonHerramientas';
import useOpcionesDeHerramientas from '../../../ventanas/useOpcionesDeHerramientas';
import { useNavegacionDock } from '../../../ventanas/navegacionDock';
import { useAuth } from '../../../contexts/AuthContext';
import DockEdicion from './DockEdicion';
import DockLateral from './DockLateral';
import { BotonFila, TarjetaFlotante } from './TarjetaSesion';
import { useModoDock } from '../../../ventanas/modoDock';
import { agrupar } from '../../../ventanas/catalogoHerramientas';
import { hidratarDock } from '../../../sesion/dockServidor';
import { BookOpen, Bug, Eye, Banknote, Plus, Receipt, Wrench } from 'lucide-react';
import { abrirBuscarLead } from '../../../ventanas/buscarLead';
import { usePlaybook } from '../../../contexts/PlaybookContext';
import { abrirSimulacion, puedeSimular } from '../../../sesion/simulacion';
import { abrirLearnito, puedeUsarLearnito } from '../../../sesion/learnito';
import { abrirReporteDeBug } from '../../../utils/bugReportBus';
import '../dock2.css';

const HUMO_DOCK = ['var(--brand-secondary)', 'var(--brand-primary)',
    'var(--brand-secondary-light)', 'var(--brand-navy)'];

/**
 * El dock de secciones: la barra fija de abajo, numerada, con el indicador que se desliza hasta
 * la sección activa.
 *
 * Vive aparte porque lo usan dos pantallas: el dashboard comercial y el espacio del setter. Tienen
 * que ser EL MISMO panel y no una copia —el pedido fue justamente que el setter no viera un dock
 * al trabajar y otro al entrar a sus datos—, así que las dos lo montan de acá.
 *
 * Tiene que quedar dentro de un `.dc-shell`: sus estilos (`.dock`, `.dock-item`, `.dock-ind`)
 * cuelgan de ese shell. Quien no es el dashboard lo envuelve en un `.dc-shell--embebido`.
 *
 * `antes` es lo que va a la izquierda de la navegación, separado por una línea: en el dashboard,
 * el switch Closers/Setters de la dirección. `despues`, lo mismo a la derecha: en el mazo del
 * closer, su sesión (`MenuSesion`). Va pegado al borde derecho aunque el dock scrollee (en un
 * teléfono no entra): ahí vive cerrar sesión, y no puede quedar fuera de la vista.
 *
 * Una sección puede traer `marca: { texto, titulo }`: una insignia chica al lado del nombre (el
 * "✓" del reporte ya enviado). `titulo` es lo que se lee en voz alta, porque el `aria-label` del
 * botón tapa su contenido. Si necesita más de una, `marcas: [...]`. Cada una puede ser de un
 * `tipo`: sin tipo es el "✓"; `cuenta` es una pastilla con lo hecho sobre el total ("2/5", las
 * pestañas del closer), `apagada` cuando ya no queda nada por hacer ahí; `aviso` es un punto ámbar
 * sin texto (el día de ayer que quedó sin reportar).
 *
 * `siempreNombres`: el nombre de cada sección se ve SIEMPRE (el dashboard comercial, 08/10/2026:
 * con Finanzas y Payroll son siete y solo se leía la activa). En vez de esconder los nombres
 * cuando no entran, el dock se aprieta (`dock--apretado`: menos aire y letra un punto más chica) y,
 * si ni así entra, scrollea de costado como en el teléfono.
 *
 * Tres zonas (19/10/2026): a la izquierda las acciones fijadas (`DockFijadas`), en el medio la
 * navegación y a la derecha la sesión. Las fijadas salen del `MenuSesion` que va en `despues`: se las
 * pasa por `DockContexto` con `publicar`, y el dock las guarda solo si cambiaron (se compara una firma,
 * no la lista, que es nueva en cada render). Tocar una corre la acción más reciente de esa opción.
 *
 * Dock 2.0 (17/11/2026, como el de Leadership y la Academia): en una pantalla ancha son tres islas
 * sueltas. Izquierda, lo fijado; centro, la navegación; derecha, «Herramientas» (`BotonHerramientas`)
 * y la sesión. La navegación se edita (ordenar, ocultar, renombrar: `ventanas/navegacionDock.js`), y
 * una sección oculta se abre desde Herramientas o fijada a la izquierda. En un teléfono vuelve a ser
 * una sola barra.
 */
const ANGOSTO = '(max-width: 640px)';
const useAngosto = () => {
    const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(ANGOSTO).matches);
    useEffect(() => {
        const mq = window.matchMedia?.(ANGOSTO);
        if (!mq) return undefined;
        const cambio = (e) => setAngosto(e.matches);
        mq.addEventListener('change', cambio);
        return () => mq.removeEventListener('change', cambio);
    }, []);
    return angosto;
};

const marcasDe = (s) => s.marcas || (s.marca ? [s.marca] : []);

const claseDeMarca = (m) => ['dock-marca', m.tipo && `dock-marca--${m.tipo}`, m.apagada && 'dock-marca--apagada']
    .filter(Boolean).join(' ');

const DockSecciones = ({ secciones: todasLasSecciones, activa, onElegir, ariaLabel, antes = null, despues = null,
    siempreNombres = false }) => {
    const auth = useAuth();
    const usuario = auth?.user;
    // El dock guardado en la cuenta pisa al del navegador (ADR-W164).
    useEffect(() => { hidratarDock(usuario); }, [usuario]);
    const nav = useNavegacionDock(usuario, ariaLabel, todasLasSecciones);
    const secciones = nav.visibles;
    const angosto = useAngosto();
    const modo = useModoDock();
    const lateral = modo.lateral && !angosto;
    const herramientas = useOpcionesDeHerramientas();
    // El indicador se mide del DOM porque su ancho es el del botón activo, y eso depende del texto
    // de cada sección y de si el label está visible (bajo 1120px se esconde el de los inactivos).
    // Se remide al cambiar de sección, al cambiar la lista y al redimensionar.
    const navRef = useRef(null);
    const [indicador, setIndicador] = useState({ '--w': '0px', '--x': '0px' });
    // Si el dock no entra y scrollea. Solo entonces `despues` necesita fondo propio, para que las
    // secciones que pasan por debajo no se le vean a través: con el dock entero, ese fondo era un
    // parche más oscuro sobre el humo.
    const [desborda, setDesborda] = useState(false);
    // Si con el nombre de todas las secciones el dock no entra: entonces se esconde el de las
    // inactivas (`dock--compacto`). Se mide en vez de cortar en un ancho fijo porque lo que mide el
    // dock depende de quién lo usa —el switch de la dirección, la sesión al final, las cuentas del
    // closer— y un corte pensado para uno dejaba al otro scrolleando (30/09/2026).
    const [compacto, setCompacto] = useState(false);
    // Lo que se hace cuando no entra: esconder los nombres de las inactivas, o apretar el dock.
    const claseSinLugar = siempreNombres ? 'dock--apretado' : 'dock--compacto';
    const ids = secciones.map(s => s.id).join('|');

    const accionesRef = useRef([]);
    const [fijables, setFijables] = useState({ firma: '', usuario: null, opciones: [] });
    const publicar = useCallback((usuario, opciones) => {
        accionesRef.current = opciones;
        const firma = `${usuario?.id ?? ''}#${opciones.map(o => `${o.id}:${o.label}:${o.cuenta ?? ''}:${o.titulo ?? ''}`).join('|')}`;
        setFijables(prev => (prev.firma === firma ? prev : { firma, usuario, opciones }));
    }, []);
    // Lo que se puede fijar: las acciones del menú de sesión, las herramientas en ventana y las secciones ocultas.
    // Una oculta con `pendientes` (Compartidos, Abandonos) lleva su cuenta y, mientras tenga, queda fijada (ADR-W256).
    const ocultas = nav.ocultas.map(s => ({ id: `sec:${s.id}`, label: s.label, titulo: s.titulo, Icono: s.Icono,
        cuenta: s.pendientes > 0 ? s.pendientes : null, conPendientes: s.pendientes !== undefined,
        onClick: () => onElegir(s.id) }));
    // Las del menú corren su acción más reciente (accionesRef): la guardada en `fijables` puede ser vieja.
    const opcionesRef = useRef([]);
    const correr = useCallback((id) => (accionesRef.current.find(o => o.id === id)
        || opcionesRef.current.find(o => o.id === id))?.onClick(), []);
    const publicadas = fijables.opciones.map(o => ({ ...o, onClick: () => correr(o.id) }));
    const configuracion = publicadas.find(o => o.seccion === 'config') || null;
    const acciones = publicadas.filter(o => o.seccion !== 'config');
    // «Nuevo», una herramienta más (se fija como cualquiera): abre la lista de lo que crea algo en esta
    // pantalla (las acciones con `nuevo`) y «Reportar o pedir algo», que va en todas.
    const reportar = { id: 'reportar-bug', label: 'Reportar o pedir algo', Icono: Bug, onClick: abrirReporteDeBug };
    const venden = ['closer', 'triage', 'admin', 'director_comercial'].includes(usuario?.role);
    const nuevos = [...acciones.filter(o => o.nuevo),
        ...(venden ? [
            { id: 'nuevo-pago', label: 'Registrar un pago', Icono: Receipt, onClick: () => abrirBuscarLead('pago') },
            { id: 'nuevo-venta', label: 'Declarar una venta', Icono: Banknote, onClick: () => abrirBuscarLead('venta') },
        ] : []),
        reportar];
    const nuevosRef = useRef(nuevos);
    nuevosRef.current = nuevos;
    const nuevo = { id: 'nuevo', label: 'Nuevo', Icono: Plus, titulo: nuevos.map(o => o.label).join(' · '),
        panel: { titulo: 'Nuevo', vacio: 'Nada para crear acá.', cargar: () => nuevosRef.current } };
    const deCuenta = acciones.filter(o => o.seccion === 'cuenta');
    const deAccion = acciones.filter(o => o.seccion !== 'cuenta' && !o.nuevo);
    const sinLeer = deCuenta.reduce((n, o) => n + (Number(o.cuenta) || 0), 0);
    // Las que están en todas las pantallas: el Playbook (con lo pendiente) y Simular, que antes había que
    // buscar dentro del Portal.
    const playbook = usePlaybook();
    const globales = [
        { id: 'playbook', label: 'Playbook', Icono: BookOpen, onClick: () => playbook.openPlaybook('pending'),
            cuenta: playbook.pendingCount > 0 ? playbook.pendingCount : null,
            titulo: playbook.pendingCount > 0 ? `${playbook.pendingCount} ${playbook.pendingCount === 1 ? 'video pendiente' : 'videos pendientes'}` : null },
        ...(puedeSimular(usuario) ? [{ id: 'simular', label: 'Simular a alguien', Icono: Eye, onClick: abrirSimulacion }] : []),
    ];
    const opciones = [nuevo, ...acciones, reportar, ...herramientas, ...globales, ...ocultas];
    // Atajos, como en la Academia: Ctrl+K busca un lead, Ctrl+L abre Learnito y Ctrl+J, Herramientas.
    useEffect(() => {
        const tecla = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
            const k = e.key.toLowerCase();
            if (k === 'k' && herramientas.some(h => h.id === 'tool:buscar') && !document.querySelector('.talent')) {
                e.preventDefault(); abrirBuscarLead(null);
            } else if (k === 'l' && puedeUsarLearnito(usuario)) {
                e.preventDefault(); abrirLearnito();
            } else if (k === 'j') {
                e.preventDefault(); window.dispatchEvent(new CustomEvent('abrir-herramientas'));
            }
        };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [herramientas, usuario]);
    opcionesRef.current = opciones;
    const contexto = useMemo(() => ({ publicar }), [publicar]);
    useEffect(() => {
        const medir = () => {
            const nav = navRef.current;
            const item = nav?.querySelector('[aria-current="page"]');
            if (!nav) return;
            if (!item) { setIndicador({ '--w': '0px', '--x': '0px' }); return; }
            const dock = nav.parentElement;

            // ¿Entra con todos los nombres? Se prueba sacando `dock--compacto` un instante: es
            // sincrónico, el navegador no llega a pintar en el medio. Así no oscila: lo que se
            // compara es siempre el ancho con nombres, no el que dejó la medición anterior.
            if (dock) {
                dock.classList.remove(claseSinLugar);
                const noEntra = dock.scrollWidth > dock.clientWidth + 1;
                // Se deja la clase según lo medido y no como estaba: si la decisión no cambia,
                // React no vuelve a dibujar, y una clase repuesta a mano quedaba pegada aunque ya
                // entrara (se veía apretado un dock con lugar de sobra).
                dock.classList.toggle(claseSinLugar, noEntra);
                setCompacto(noEntra);
            }

            setIndicador({ '--w': `${item.offsetWidth}px`, '--x': `${item.offsetLeft}px` });

            // En un teléfono el dock no entra ni compacto y scrollea de costado: sin esto la sección
            // activa podía quedar cortada contra el borde, justo la única con el nombre a la vista.
            const scrollea = !!dock && dock.scrollWidth > dock.clientWidth;
            setDesborda(scrollea);
            if (!scrollea) return;
            // Lo que va pegado a la derecha (`despues`) tapa ese pedazo: no cuenta como visible.
            const tapa = dock.querySelector('.dock-despues')?.offsetWidth || 0;
            const ini = nav.offsetLeft + item.offsetLeft;
            const fin = ini + item.offsetWidth;
            if (ini < dock.scrollLeft) dock.scrollLeft = ini - 8;
            else if (fin > dock.scrollLeft + dock.clientWidth - tapa) dock.scrollLeft = fin - dock.clientWidth + tapa + 8;
        };
        const id = requestAnimationFrame(medir);
        window.addEventListener('resize', medir);
        // Y cada vez que el dock o sus secciones cambian de tamaño de verdad. El `resize` de la
        // ventana no alcanza: el ancho máximo del dock depende de `100vw`, y hay navegadores (la
        // emulación de tamaños de Chrome, al menos) que lo acomodan después del aviso, así que se
        // medía el tamaño de antes y el dock quedaba un paso atrás —se agrandaba la ventana y
        // seguía compacto—. También cubre lo que cambia sin tocar la ventana (una cuenta que
        // pasa de "9/9" a "10/12"). No oscila: la medición compara siempre el ancho con nombres.
        const nav = navRef.current;
        const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => medir());
        if (observador && nav) {
            observador.observe(nav);
            if (nav.parentElement) observador.observe(nav.parentElement);
        }
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener('resize', medir);
            observador?.disconnect();
        };
    }, [activa, ids, compacto, claseSinLugar, nav.editando, angosto]);

    // Con seis cosas o más en el dock (el mazo del closer, o la dirección con su switch y su sesión)
    // el aire de las cuatro secciones del dashboard no entra en una laptop: `dock--denso` las junta.
    const cosas = secciones.length + (antes ? 1 : 0) + (despues ? 1 : 0);
    const clases = ['dock', !angosto && 'dock--centro', cosas >= 6 && 'dock--denso', siempreNombres && 'dock--nombres',
        compacto && claseSinLugar, desborda && 'dock--desborda', nav.editando && 'dock--editando', 'caja'];
    // Plegada, la barra lateral muestra hasta 3 fijadas; el resto, en Herramientas.
    const plegada = lateral && !modo.desplegada;
    const fijadas = <DockFijadas usuario={fijables.usuario || usuario} opciones={opciones} onElegir={correr} sep={angosto && !lateral ? 'despues' : null}
        tope={plegada ? 3 : null} onMas={() => window.dispatchEvent(new CustomEvent('abrir-herramientas'))} />;
    const herr = (
        <BotonHerramientas usuario={usuario} onEditar={todasLasSecciones.length > 1 && usuario ? () => nav.editar(true) : null}
            cuenta={sinLeer > 0 ? (sinLeer > 99 ? '99+' : sinLeer) : null}
            principal grupos={agrupar([nuevo, ...herramientas, ...globales, ...deAccion, ...ocultas, ...deCuenta])} />
    );
    const centro = (
        <nav className={clases.filter(Boolean).join(' ')} aria-label={ariaLabel}>
            <Humo colores={HUMO_DOCK} />
            {angosto && fijadas}
            {antes}
            {antes && <span className="dock-sep" />}
            <div className="dock-nav" ref={navRef}>
                {nav.editando ? <DockEdicion nav={nav} /> : (
                    <>
                        {/* Indicador que se desliza hasta el item activo, en vez de que cada uno pinte su
                            propio fondo: el movimiento dice de dónde a dónde se fue. */}
                        <span className="dock-ind" style={indicador} aria-hidden="true" />
                        {secciones.map((s) => {
                            const marcas = marcasDe(s);
                            return (
                                <button key={s.id} type="button" className="dock-item"
                                    aria-current={activa === s.id ? 'page' : undefined}
                                    aria-label={[s.label, ...marcas.map(m => m.titulo)].join(', ')}
                                    data-dock-tip={[s.label, marcas.map(m => m.titulo).filter(Boolean).join(' · ')].filter(Boolean).join('|')}
                                    onClick={() => onElegir(s.id)}>
                                    <s.Icono size={20} />
                                    <span className="dock-label">{s.label}</span>
                                    {s.pronto && <span className="dock-pronto">Pronto</span>}
                                    {marcas.map(m => (
                                        <span key={m.titulo} className={claseDeMarca(m)} aria-hidden="true">{m.texto}</span>
                                    ))}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
            <IslaVentanas />
            {angosto && (
                <div className="dock-despues">
                    <span className="dock-sep" />
                    {herr}
                    {despues}
                </div>
            )}
        </nav>
    );
    const sesion = { configuracion, avisos: acciones.find(o => o.id === 'avisos'),
        salir: acciones.find(o => o.id === 'salir'), volver: acciones.find(o => o.id === 'volver') };
    if (lateral) {
        return (
            <DockContexto.Provider value={contexto}>
                <DockTip />
                <DockLateral secciones={secciones} activa={activa} onElegir={onElegir} ariaLabel={ariaLabel} antes={antes}
                    despues={despues} herr={herr} fijadas={fijadas} nav={nav} modo={modo} marcasDe={marcasDe} claseDeMarca={claseDeMarca}
                    usuario={usuario} {...sesion} />
            </DockContexto.Provider>
        );
    }
    return (
        <DockContexto.Provider value={contexto}>
            <DockTip />
            {angosto ? centro : (
                <div className="dock-barra">
                    <div className="dock-isla dock-isla--izq">{fijadas}</div>
                    {centro}
                    <div className="dock-isla dock-isla--der">
                        {herr}
                        {despues && <span className="dock-sep" />}
                        {despues && (
                            // Al pasar el mouse por el avatar, la misma tarjeta que la barra lateral. Su Herramientas
                            // abre el menú de la isla (el de la tarjeta se escondería al irse el mouse).
                            <TarjetaFlotante avatar={despues} usuario={usuario} {...sesion}
                                herr={<BotonFila Icono={Wrench} label="Herramientas · Ctrl+J" cuenta={sinLeer > 0 ? (sinLeer > 99 ? '99+' : sinLeer) : null}
                                    onClick={() => window.dispatchEvent(new CustomEvent('abrir-herramientas'))} />} />
                        )}
                    </div>
                </div>
            )}
        </DockContexto.Provider>
    );
};

export { HUMO_DOCK };
export default DockSecciones;
