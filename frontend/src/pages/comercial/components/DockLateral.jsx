import { useEffect } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import IslaVentanas from '../../../ventanas/IslaVentanas';
import DockEdicion from './DockEdicion';

/**
 * La barra lateral, la alternativa al dock de abajo (Configuración › Dock; como la de la Academia,
 * `dockbar/partials/vertical.blade.php`). De arriba abajo: plegar o desplegar, tu personaje
 * (Configuración) y Herramientas; las secciones; y al fondo las ventanas abiertas y lo fijado. Plegada,
 * solo íconos (el nombre en el `title`). Mientras está, la página se corre a la derecha (`html.dock-lateral`).
 */
const DockLateral = ({ secciones, activa, onElegir, ariaLabel, antes, despues, herr, fijadas, nav, modo, marcasDe, claseDeMarca }) => {
    const { desplegada, setDesplegada } = modo;
    useEffect(() => {
        const raiz = document.documentElement;
        raiz.classList.add('dock-lateral');
        raiz.classList.toggle('dock-lateral--abierta', desplegada);
        return () => raiz.classList.remove('dock-lateral', 'dock-lateral--abierta');
    }, [desplegada]);

    return (
        <aside className={`dock-lado${desplegada ? ' dock-lado--abierta' : ''}`} aria-label={ariaLabel}>
            <div className="dock-lado-cab">
                <button type="button" className="dock-fijada dock-lado-plegar" onClick={() => setDesplegada(!desplegada)}
                    aria-label={desplegada ? 'Plegar la barra' : 'Desplegar la barra'} title={desplegada ? 'Plegar' : 'Desplegar'}>
                    {desplegada ? <ChevronsLeft size={19} aria-hidden="true" /> : <ChevronsRight size={19} aria-hidden="true" />}
                </button>
                {despues}
                {herr}
            </div>
            {desplegada && antes && <div className="dock-lado-antes">{antes}</div>}
            <div className="dock-lado-nav dock-nav">
                {nav.editando ? <DockEdicion nav={nav} /> : secciones.map((s) => {
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
            </div>
            <div className="dock-lado-fin">
                <IslaVentanas />
                {fijadas}
            </div>
        </aside>
    );
};

export default DockLateral;
