// Configuración › Dock (como «Tu dock» de la Academia): el dock abajo o una barra lateral, y la barra
// desplegada o solo íconos. Se guarda en este navegador (ventanas/modoDock.js). En el teléfono siempre
// es el dock de abajo.
import { Segmented } from '../components/standard';
import { useModoDock } from '../ventanas/modoDock';

export default function TabDock() {
    const modo = useModoDock();
    return (
        <section className="cu-dock" aria-label="Dock">
            <div className="cu-dock-fila">
                <b className="t-sm">Navegación</b>
                <Segmented label="Dónde va la navegación" value={modo.lateral ? 'lateral' : 'abajo'}
                    onChange={(v) => modo.setLateral(v === 'lateral')}
                    options={[{ value: 'abajo', label: 'Dock abajo' }, { value: 'lateral', label: 'Barra lateral' }]} />
            </div>
            {modo.lateral && (
                <div className="cu-dock-fila">
                    <b className="t-sm">Barra lateral</b>
                    <Segmented label="Cómo se ve la barra" value={modo.desplegada ? 'si' : 'no'}
                        onChange={(v) => modo.setDesplegada(v === 'si')}
                        options={[{ value: 'si', label: 'Desplegada' }, { value: 'no', label: 'Solo íconos' }]} />
                </div>
            )}
            <p className="t-sm mut">
                En el celular siempre va abajo. Para ordenar, ocultar o renombrar las secciones: Herramientas › Editar navegación.
            </p>
        </section>
    );
}
