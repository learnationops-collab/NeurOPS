import { useFijadas } from '../../../sesion/fijadas';

/**
 * La sección de la izquierda del dock: las acciones del menú de sesión que el usuario fijó (Learnito,
 * Nueva agenda…), como accesos de un toque. Las opciones salen del `MenuSesion` del mismo dock (se las
 * pasa por `DockContexto`), así cada pantalla aporta las suyas y una fijada que no existe en esta
 * pantalla no se dibuja. El orden es el de cuándo se fijaron. Sin ninguna, no ocupa lugar.
 */
const DockFijadas = ({ usuario, opciones, onElegir }) => {
    const { fijadas } = useFijadas(usuario);
    const porId = new Map(opciones.map((op) => [op.id, op]));
    const visibles = fijadas.map((id) => porId.get(id)).filter(Boolean);
    if (!visibles.length) return null;
    return (
        <>
            <div className="dock-fijadas" role="group" aria-label="Accesos fijados">
                {visibles.map((op) => (
                    <button key={op.id} type="button" className="dock-fijada" onClick={() => onElegir(op.id)}
                        aria-label={op.titulo ? `${op.label}, ${op.titulo}` : op.label} title={op.label}>
                        <op.Icono size={19} aria-hidden="true" />
                        {op.cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{op.cuenta}</span>}
                    </button>
                ))}
            </div>
            <span className="dock-sep" />
        </>
    );
};

export default DockFijadas;
