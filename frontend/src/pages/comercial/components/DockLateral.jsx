import { useEffect } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import IslaVentanas from '../../../ventanas/IslaVentanas';
import DockEdicion from './DockEdicion';
import { BotonNotificaciones, FilaSesion, NombreSesion } from './TarjetaSesion';

const TOPE_SECCIONES = 5;

/**
 * La barra lateral, la alternativa al dock de abajo (Configuración › Dock), como el mockup del dock
 * unificado (docs/mockups/dock-unificado, ADR-W165). Dos contenedores separados:
 *   · la tarjeta (TarjetaSesion.jsx): plegar arriba a la izquierda, Notificaciones a la derecha, el
 *     personaje grande (abre Configuración) y el nombre, la fila de la sesión y después lo fijado;
 *   · la navegación: las secciones, sin número, con su señal, y al fondo las ventanas abiertas.
 * Plegada: una columna de íconos con hasta 3 fijadas y 5 secciones (la activa siempre entre ellas); el
 * resto, en un «+N». Mientras está, la página se corre a la derecha (`html.dock-lateral`).
 */
/** Las secciones que se ven plegada: las primeras, con la activa siempre adentro. */
const seccionesPlegada = (secciones, activa) => {
    if (secciones.length <= TOPE_SECCIONES) return secciones;
    const primeras = secciones.slice(0, TOPE_SECCIONES);
    if (primeras.some(s => s.id === activa)) return primeras;
    return [...secciones.slice(0, TOPE_SECCIONES - 1), secciones.find(s => s.id === activa)].filter(Boolean);
};

const DockLateral = ({ secciones, activa, onElegir, ariaLabel, antes, despues, herr, fijadas, nav, modo,
    marcasDe, claseDeMarca, usuario, configuracion, avisos, salir, volver }) => {
    const { desplegada, setDesplegada } = modo;
    useEffect(() => {
        const raiz = document.documentElement;
        raiz.classList.add('dock-lateral');
        raiz.classList.toggle('dock-lateral--abierta', desplegada);
        return () => raiz.classList.remove('dock-lateral', 'dock-lateral--abierta');
    }, [desplegada]);
    const vistas = desplegada ? secciones : seccionesPlegada(secciones, activa);
    const resto = secciones.length - vistas.length;

    return (
        <aside className={`dock-lado${desplegada ? ' dock-lado--abierta' : ''}`} aria-label={ariaLabel}>
            <section className="dock-lado-tarjeta" aria-label="Tu sesión">
                <button type="button" className="dock-lado-plegar" onClick={() => setDesplegada(!desplegada)}
                    aria-label={desplegada ? 'Plegar la barra' : 'Desplegar la barra'} title={desplegada ? 'Plegar' : 'Desplegar'}>
                    {desplegada ? <ChevronsLeft size={17} aria-hidden="true" /> : <ChevronsRight size={17} aria-hidden="true" />}
                </button>
                {desplegada && <BotonNotificaciones avisos={avisos} />}
                <div className="dock-lado-quien">
                    {despues}
                    {desplegada && <NombreSesion usuario={usuario} />}
                </div>
                {desplegada ? (
                    <FilaSesion usuario={usuario} herr={herr} configuracion={configuracion} salir={salir} />
                ) : (
                    <div className="dock-lado-acciones"><span className="dock-lado-herr">{herr}</span></div>
                )}
                {volver && (
                    <button type="button" className="dock-lado-volver" onClick={volver.onClick} title={volver.label} aria-label={volver.label}>
                        <volver.Icono size={17} aria-hidden="true" />
                        {desplegada && <span className="trunc">{volver.label}</span>}
                    </button>
                )}
                {fijadas && <div className="dock-lado-fijadas">{fijadas}</div>}
            </section>

            <nav className="dock-lado-nav" aria-label="Secciones">
                {desplegada && antes && <div className="dock-lado-antes">{antes}</div>}
                {nav.editando ? <div className="dock-nav dock-lado-editar"><DockEdicion nav={nav} /></div> : vistas.map((s) => {
                    const marcas = marcasDe(s);
                    return (
                        <button key={s.id} type="button" className="dock-lado-item" title={desplegada ? undefined : s.label}
                            aria-current={activa === s.id ? 'page' : undefined}
                            aria-label={[s.label, ...marcas.map(m => m.titulo)].join(', ')}
                            onClick={() => onElegir(s.id)}>
                            <s.Icono size={20} aria-hidden="true" />
                            {desplegada && <span className="trunc">{s.label}</span>}
                            {marcas.map(m => (
                                <span key={m.titulo} className={claseDeMarca(m)} aria-hidden="true">{m.texto}</span>
                            ))}
                        </button>
                    );
                })}
                {!nav.editando && resto > 0 && (
                    <button type="button" className="dock-lado-item dock-mas" onClick={() => setDesplegada(true)}
                        aria-label={`${resto} ${resto === 1 ? 'sección más' : 'secciones más'}: desplegar la barra`} title="Desplegar la barra">
                        +{resto}
                    </button>
                )}
                <div className="dock-lado-fin"><IslaVentanas /></div>
            </nav>
        </aside>
    );
};

export default DockLateral;
