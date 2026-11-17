import { useEffect } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import IslaVentanas from '../../../ventanas/IslaVentanas';
import { rotuloDeSesion } from '../../../sesion/menuSesion';
import DockEdicion from './DockEdicion';

/**
 * La barra lateral, la alternativa al dock de abajo (Configuración › Dock; como la de la Academia,
 * `dockbar/partials/vertical.blade.php`). Tres secciones, todo alineado a la izquierda:
 *   · la tarjeta de usuario: tu personaje grande (abre Configuración), tu nombre y rol, Herramientas,
 *     cerrar sesión (y volver a tu sesión si simulás) y lo que fijaste;
 *   · la navegación;
 *   · al fondo, las ventanas abiertas (solo si hay).
 * Plegada, solo íconos en columna (el nombre en el `title`). Mientras está, la página se corre a la
 * derecha (`html.dock-lateral`).
 */
const DockLateral = ({ secciones, activa, onElegir, ariaLabel, antes, despues, herr, fijadas, nav, modo,
    marcasDe, claseDeMarca, usuario, salida }) => {
    const { desplegada, setDesplegada } = modo;
    useEffect(() => {
        const raiz = document.documentElement;
        raiz.classList.add('dock-lateral');
        raiz.classList.toggle('dock-lateral--abierta', desplegada);
        return () => raiz.classList.remove('dock-lateral', 'dock-lateral--abierta');
    }, [desplegada]);
    const nombre = usuario?.name || usuario?.username || '';
    const plegar = (
        <button type="button" className="dock-lado-plegar" onClick={() => setDesplegada(!desplegada)}
            aria-label={desplegada ? 'Plegar la barra' : 'Desplegar la barra'} title={desplegada ? 'Plegar' : 'Desplegar'}>
            {desplegada ? <ChevronsLeft size={17} aria-hidden="true" /> : <ChevronsRight size={17} aria-hidden="true" />}
        </button>
    );

    return (
        <aside className={`dock-lado${desplegada ? ' dock-lado--abierta' : ''}`} aria-label={ariaLabel}>
            <section className="dock-lado-tarjeta" aria-label="Tu sesión">
                {!desplegada && plegar}
                <div className="dock-lado-quien">
                    {despues}
                    {desplegada && (
                        <span className="dock-lado-nombre">
                            <b className="trunc">{nombre}</b>
                            <small className="trunc">{rotuloDeSesion(usuario)}</small>
                        </span>
                    )}
                    {desplegada && plegar}
                </div>
                <div className="dock-lado-acciones">
                    <span className="dock-lado-herr">{herr}</span>
                    {salida.map(op => (
                        <button key={op.id} type="button" className="dock-fijada dock-lado-salir" onClick={op.onClick}
                            aria-label={op.label} title={op.label}>
                            <op.Icono size={18} aria-hidden="true" />
                        </button>
                    ))}
                </div>
                {fijadas && <div className="dock-lado-fijadas">{fijadas}</div>}
            </section>

            <nav className="dock-lado-nav" aria-label="Secciones">
                {desplegada && antes && <div className="dock-lado-antes">{antes}</div>}
                {nav.editando ? <div className="dock-nav dock-lado-editar"><DockEdicion nav={nav} /></div> : secciones.map((s, i) => {
                    const marcas = marcasDe(s);
                    return (
                        <button key={s.id} type="button" className="dock-lado-item" title={desplegada ? undefined : s.label}
                            aria-current={activa === s.id ? 'page' : undefined}
                            aria-label={[s.label, ...marcas.map(m => m.titulo)].join(', ')}
                            onClick={() => onElegir(s.id)}>
                            <s.Icono size={20} aria-hidden="true" />
                            {desplegada && <span className="trunc">{s.label}</span>}
                            {desplegada && <span className="dock-lado-num" aria-hidden="true">{i + 1}</span>}
                            {marcas.map(m => (
                                <span key={m.titulo} className={claseDeMarca(m)} aria-hidden="true">{m.texto}</span>
                            ))}
                        </button>
                    );
                })}
            </nav>

            <div className="dock-lado-fin">
                <IslaVentanas />
            </div>
        </aside>
    );
};

export default DockLateral;
