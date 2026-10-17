import { Skeleton, SkeletonBlock, SkeletonRow, SkeletonText } from '../../../../components/standard';

/**
 * Talleres mientras no llegaron: tres tarjetas (una fila a cualquier ancho de escritorio, nunca una
 * suelta abajo) con las piezas de `TarjetaTaller` a su alto real, o las filas de la tabla.
 */

const ETAPAS = 7;

const Tarjeta = ({ i }) => (
    <article className="wt-tarjeta" aria-hidden="true">
        <div className="wt-tarjeta-cab">
            <SkeletonBlock height={10} width={88} step={i} />
            <div className="wt-tarjeta-acciones">
                <SkeletonBlock height={32} width={112} radius={999} step={i} />
                <SkeletonBlock height={30} width={30} radius="50%" step={i} />
                <SkeletonBlock height={30} width={30} radius="50%" step={i} />
            </div>
        </div>
        <SkeletonText height={14} lineHeight={21.3} width="78%" step={i + 1} />
        <div className="pareja wt-tarjeta-cifras" style={{ '--min': '78px', '--g': 'var(--s2)' }}>
            {[0, 1, 2, 3].map((k) => <SkeletonBlock key={k} height={57.5} radius={12} step={i + 2} />)}
        </div>
        <SkeletonText height={9} lineHeight={17.4} width="70%" step={i + 3} />
        <SkeletonBlock height={44} radius={999} step={i + 4} />
        <div className="ui-skel-stack" style={{ gap: 17, paddingBlock: 10 }}>
            {Array.from({ length: ETAPAS }, (_, k) => (
                <SkeletonRow key={k} cells={['70%', '100%', '60%']} columns="70px minmax(0, 1fr) 72px" height={10} step={i + 5 + k} />
            ))}
        </div>
        <SkeletonBlock height={38} radius={999} step={i + 12} />
    </article>
);

export const EsqueletoTarjetas = () => (
    <Skeleton label="Cargando los talleres…" className="wt-tarjetas">
        {[0, 1, 2].map((i) => <Tarjeta key={i} i={i} />)}
    </Skeleton>
);

export const EsqueletoTabla = () => (
    <Skeleton label="Cargando los talleres…" className="panel" style={{ display: 'grid', gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => (
            <SkeletonRow key={i} cells={['60%', '80%', '50%', '50%', '40%', '40%']} height={44} step={i} />
        ))}
    </Skeleton>
);
