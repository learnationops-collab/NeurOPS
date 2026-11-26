import { tienePendientes, useFijadas } from '../../../sesion/fijadas';
import BotonHerramientas from '../../../ventanas/BotonHerramientas';

/**
 * Lo fijado en el dock (isla izquierda): las opciones de Herramientas que el usuario fijó (Nuevo,
 * Learnito, Turnos…), como accesos de un toque. Las opciones las arma `DockSecciones` (las de la pantalla
 * le llegan del `MenuSesion` por `DockContexto`), así una fijada que no existe en esta pantalla no se
 * dibuja. Una que abre una lista (Nuevo) abre directo esa lista. El orden es el de cuándo se fijaron.
 * Sin ninguna, no ocupa lugar. `sep`: dónde va la línea que la separa ('antes', 'despues' o null).
 */
// `tope`: cuántas se dibujan como mucho (la barra lateral plegada, 3); el resto queda en un «+N» que corre `onMas`.
const DockFijadas = ({ usuario, opciones, onElegir, sep = 'despues', tope = null, onMas = null }) => {
    const { fijadas } = useFijadas(usuario);
    const porId = new Map(opciones.map((op) => [op.id, op]));
    // Lo que tiene pendientes va primero aunque no esté fijado, hasta resolverse (ADR-W242).
    const pendientes = opciones.filter(tienePendientes);
    const todas = [...pendientes, ...fijadas.filter((id) => !pendientes.some((p) => p.id === id))
        .map((id) => porId.get(id)).filter(Boolean)];
    if (!todas.length) return null;
    const visibles = tope ? todas.slice(0, tope) : todas;
    const resto = todas.length - visibles.length;
    return (
        <>
            {sep === 'antes' && <span className="dock-sep" />}
            <div className="dock-fijadas" role="group" aria-label="Accesos fijados">
                {visibles.map((op) => (op.panel ? (
                    <BotonHerramientas key={op.id} usuario={usuario} Icono={op.Icono} rotulo={op.label} panelInicial={op} />
                ) : (
                    <button key={op.id} type="button" className={`dock-fijada${tienePendientes(op) ? ' dock-fijada--pendiente' : ''}`} onClick={() => onElegir(op.id)}
                        aria-label={op.titulo ? `${op.label}, ${op.titulo}` : op.label}
                        title={tienePendientes(op) ? `${op.label} · ${op.titulo || op.cuenta} · fijada hasta resolverse` : op.label}>
                        <op.Icono size={19} aria-hidden="true" />
                        {op.cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{op.cuenta}</span>}
                    </button>
                )))}
                {resto > 0 && (
                    <button type="button" className="dock-fijada dock-mas" onClick={onMas}
                        aria-label={`${resto} ${resto === 1 ? 'acceso fijado más' : 'accesos fijados más'}, en Herramientas`} title="Más en Herramientas">
                        +{resto}
                    </button>
                )}
            </div>
            {sep === 'despues' && <span className="dock-sep" />}
        </>
    );
};

export default DockFijadas;
