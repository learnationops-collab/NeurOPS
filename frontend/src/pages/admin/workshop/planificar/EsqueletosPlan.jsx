import { Skeleton, SkeletonBlock, SkeletonText } from '../../../../components/standard';
import { STAGE_ORDER } from '../funnelMath';

/**
 * Los tres paneles de Planificar mientras les falta su dato. El título se sabe y se ve; el botón de
 * la cabecera y el cuerpo son huesos dentro de las MISMAS grillas que el panel real (`wp-cifras`,
 * `wp-eco`, `wp-palancas`…), así se acomodan igual a cada ancho.
 */

const Marco = ({ id, titulo, rotulo, boton = 150, children }) => (
    <Skeleton as="section" id={id} label={rotulo} className="panel wp-panel">
        <div className="panel-cab" aria-hidden="true">
            <h2 className="t-h3">{titulo}</h2>
            <div className="panel-cab-der"><SkeletonBlock height={34} width={boton} radius={999} /></div>
        </div>
        {children}
    </Skeleton>
);

export const EsqueletoProximos = () => (
    <Marco id="wp-proximos" titulo="Próximos talleres" rotulo="Cargando los próximos talleres…" boton={190}>
        {/* Lo que dibuja sin talleres por delante (aviso y renglón). Con talleres crece, pero el
            plan de al lado es más alto: la fila no cambia de alto y el Simulador no se mueve. */}
        <div className="wp-talleres" aria-hidden="true">
            <SkeletonBlock height={36.8} radius={16} step={1} />
            <SkeletonBlock height={53} radius={16} step={2} style={{ marginTop: 4 }} />
        </div>
    </Marco>
);

export const EsqueletoAcciones = () => (
    <Marco id="wp-acciones" titulo="Plan de acciones" rotulo="Cargando el plan de acciones…" boton={160}>
        <div className="wp-cifras" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={94.6} radius={16} step={i + 1} />)}
        </div>
        <div className="wp-sueltas" aria-hidden="true">
            <SkeletonText height={10} lineHeight={16.5} width={170} step={5} />
            <SkeletonText height={10} lineHeight={17.4} width="80%" step={6} />
        </div>
    </Marco>
);

export const EsqueletoSimulador = () => (
    <Marco id="wp-simulador" titulo="Simulador" rotulo="Cargando el simulador…" boton={150}>
        <div className="wp-sim-tope" aria-hidden="true">
            <SkeletonBlock height={89.7} radius={16} step={1} />
            <div className="wp-proy">
                {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={89.7} radius={16} step={i + 2} />)}
            </div>
        </div>
        <div className="wp-palancas" aria-hidden="true">
            {STAGE_ORDER.map((s, i) => <SkeletonBlock key={s.key} height={109} radius={16} step={i + 3} />)}
        </div>
    </Marco>
);
