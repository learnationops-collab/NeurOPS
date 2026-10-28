import { Skeleton, SkeletonBlock, SkeletonCircle, SkeletonText } from '../../../../components/standard';
import { STAGE_ORDER } from '../funnelMath';

/**
 * Lo que muestra el Resumen mientras le falta un dato, con las medidas del contenido real (medidas
 * a 1330 px): al llegar el dato no se mueve nada de lo de abajo.
 *
 *  - Etapas: el nombre de cada etapa ya se sabe; la barra, las cifras y el estado son huesos. Cada
 *    fila mide lo que la real (el chip de 24 px más el padding).
 *  - Prioridad y Clarity: el cuerpo de cada panel; el título lo dibuja el panel.
 *  - Filtros: las dos pastillas, del alto real (38 px).
 */

export const EsqueletoEtapas = ({ cabecera }) => (
    <Skeleton label="Cargando la salud del embudo…" className="wr-etapas wr-etapas--sin-vs">
        {cabecera}
        {STAGE_ORDER.map((s, i) => (
            <div key={s.key} className="wr-etapa" aria-hidden="true">
                <span className="wr-etapa-nombre">{s.label}</span>
                <span className="wr-etapa-pista"><SkeletonBlock height={10} radius={999} step={i} /></span>
                <span className="wr-etapa-n"><SkeletonBlock height={14} width={46} step={i} style={{ marginLeft: 'auto' }} /></span>
                <span className="wr-etapa-meta"><SkeletonBlock height={11} width={38} step={i} style={{ marginLeft: 'auto' }} /></span>
                <span className="wr-etapa-estado"><SkeletonBlock height={24} width={98} radius={999} step={i} /></span>
            </div>
        ))}
    </Skeleton>
);

export const EsqueletoPrioridad = () => (
    <Skeleton label="Cargando la prioridad…">
        <SkeletonText height={16} lineHeight={24} width="72%" className="wr-prioridad-etapa" />
        <SkeletonText height={22} lineHeight={33} width="56%" step={1} />
        <SkeletonText height={10} lineHeight={17.4} width="48%" step={2} />
        <SkeletonBlock height={34} width={150} radius={999} step={3} className="wr-prioridad-btn" />
    </Skeleton>
);

export const EsqueletoClarity = () => (
    <Skeleton label="Cargando el plan de mejora…" className="wr-clarity-cuerpo">
        <SkeletonCircle size={84} />
        <div className="wr-clarity-partes" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <div key={i} className="wr-clarity-parte">
                    <SkeletonText height={9} lineHeight={17.4} width={70} step={i} />
                    <SkeletonText height={9} lineHeight={17.4} width={30} step={i} />
                    <SkeletonBlock height={6} radius={999} step={i} style={{ gridColumn: '1 / -1' }} />
                </div>
            ))}
        </div>
    </Skeleton>
);

export const EsqueletoFiltros = () => (
    <Skeleton label="Cargando los talleres…" className="wr-filtros">
        <SkeletonBlock height={38} width={250} radius={999} />
        <SkeletonBlock height={38} width={160} radius={999} step={1} />
    </Skeleton>
);
