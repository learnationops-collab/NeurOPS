import React, { useEffect, useRef, useState } from 'react';
import { Humo } from './Shared';

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
 */
const marcasDe = (s) => s.marcas || (s.marca ? [s.marca] : []);

const claseDeMarca = (m) => ['dock-marca', m.tipo && `dock-marca--${m.tipo}`, m.apagada && 'dock-marca--apagada']
    .filter(Boolean).join(' ');

const DockSecciones = ({ secciones, activa, onElegir, ariaLabel, antes = null, despues = null,
    siempreNombres = false }) => {
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
    useEffect(() => {
        const medir = () => {
            const nav = navRef.current;
            const item = nav?.querySelector('[aria-current="page"]');
            if (!nav || !item) return;
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
    }, [activa, ids, compacto, claseSinLugar]);

    // Con seis cosas o más en el dock (el mazo del closer, o la dirección con su switch y su sesión)
    // el aire de las cuatro secciones del dashboard no entra en una laptop: `dock--denso` las junta.
    const cosas = secciones.length + (antes ? 1 : 0) + (despues ? 1 : 0);
    const clases = ['dock', cosas >= 6 && 'dock--denso', siempreNombres && 'dock--nombres',
        compacto && claseSinLugar, desborda && 'dock--desborda', 'caja'];
    return (
        <nav className={clases.filter(Boolean).join(' ')} aria-label={ariaLabel}>
            <Humo colores={HUMO_DOCK} />
            {antes}
            {antes && <span className="dock-sep" />}
            <div className="dock-nav" ref={navRef}>
                {/* Indicador que se desliza hasta el item activo, en vez de que cada uno pinte su
                    propio fondo: el movimiento dice de dónde a dónde se fue. */}
                <span className="dock-ind" style={indicador} aria-hidden="true" />
                {secciones.map((s, i) => {
                    const marcas = marcasDe(s);
                    return (
                        <button key={s.id} type="button" className="dock-item"
                            aria-current={activa === s.id ? 'page' : undefined}
                            aria-label={[s.label, ...marcas.map(m => m.titulo)].join(', ')}
                            onClick={() => onElegir(s.id)}>
                            <span className="dock-num">{i + 1}</span>
                            <s.Icono size={20} />
                            <span className="dock-label">{s.label}</span>
                            {s.pronto && <span className="dock-pronto">Pronto</span>}
                            {marcas.map(m => (
                                <span key={m.titulo} className={claseDeMarca(m)} aria-hidden="true">{m.texto}</span>
                            ))}
                        </button>
                    );
                })}
            </div>
            {despues && (
                <div className="dock-despues">
                    <span className="dock-sep" />
                    {despues}
                </div>
            )}
        </nav>
    );
};

export { HUMO_DOCK };
export default DockSecciones;
