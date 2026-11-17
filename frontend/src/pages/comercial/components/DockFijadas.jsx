import { useFijadas } from '../../../sesion/fijadas';
import BotonHerramientas from '../../../ventanas/BotonHerramientas';

/**
 * Lo fijado en el dock (isla izquierda): las opciones de Herramientas que el usuario fijó (Nuevo,
 * Learnito, Turnos…), como accesos de un toque. Las opciones las arma `DockSecciones` (las de la pantalla
 * le llegan del `MenuSesion` por `DockContexto`), así una fijada que no existe en esta pantalla no se
 * dibuja. Una que abre una lista (Nuevo) abre directo esa lista. El orden es el de cuándo se fijaron.
 * Sin ninguna, no ocupa lugar. `sep`: dónde va la línea que la separa ('antes', 'despues' o null).
 */
const DockFijadas = ({ usuario, opciones, onElegir, sep = 'despues' }) => {
    const { fijadas } = useFijadas(usuario);
    const porId = new Map(opciones.map((op) => [op.id, op]));
    const visibles = fijadas.map((id) => porId.get(id)).filter(Boolean);
    if (!visibles.length) return null;
    return (
        <>
            {sep === 'antes' && <span className="dock-sep" />}
            <div className="dock-fijadas" role="group" aria-label="Accesos fijados">
                {visibles.map((op) => (op.panel ? (
                    <BotonHerramientas key={op.id} usuario={usuario} Icono={op.Icono} rotulo={op.label} panelInicial={op} />
                ) : (
                    <button key={op.id} type="button" className="dock-fijada" onClick={() => onElegir(op.id)}
                        aria-label={op.titulo ? `${op.label}, ${op.titulo}` : op.label} title={op.label}>
                        <op.Icono size={19} aria-hidden="true" />
                        {op.cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{op.cuenta}</span>}
                    </button>
                )))}
            </div>
            {sep === 'despues' && <span className="dock-sep" />}
        </>
    );
};

export default DockFijadas;
