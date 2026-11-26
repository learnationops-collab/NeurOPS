import { tienePendientes, useFijadas } from '../../../sesion/fijadas';
import BotonHerramientas from '../../../ventanas/BotonHerramientas';
import { conFicha } from '../../../ventanas/catalogoHerramientas';

// «Nombre|Qué es» para el tooltip del dock (`DockTip`), y su color para el aura de lo pendiente.
const fichaDe = (op) => { const f = conFicha(op); return { tip: f.desc ? `${op.label}|${f.desc}` : op.label, tono: `var(--herr-${f.color || 'rosa'})` }; };

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
                        data-dock-tip={fichaDe(op).tip} style={{ '--tono': fichaDe(op).tono }}>
                        <op.Icono size={19} aria-hidden="true" />
                        {op.cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{op.cuenta}</span>}
                    </button>
                )))}
                {resto > 0 && (
                    <button type="button" className="dock-fijada dock-mas" onClick={onMas}
                        aria-label={`${resto} ${resto === 1 ? 'acceso fijado más' : 'accesos fijados más'}, en Herramientas`} data-dock-tip={`+${resto}|Más accesos fijados, en Herramientas`}>
                        +{resto}
                    </button>
                )}
            </div>
            {sep === 'despues' && <span className="dock-sep" />}
        </>
    );
};

export default DockFijadas;
