import { Skeleton, SkeletonBlock } from '../standard';
import { useColumnasVisibles } from './useColumnasVisibles';

/**
 * Lo que dibuja una `ListaConfigurable` mientras no llegaron sus filas: la misma barra (pastillas del
 * alto real), la cabecera de la tabla con los nombres de las columnas (no dependen de los datos) y filas
 * de huesos con la MISMA grilla, porque lee las columnas visibles guardadas (`claveGuardado`) igual que
 * la lista. Así, al llegar los datos, nada se corre.
 *
 * Recibe lo mismo que la lista: `columnas`, `claveGuardado`, y si tiene filtro (`facetas`), agrupar
 * (`agrupables`) o buscador (`buscar`). `filas` es cuántas filas de huesos dibujar.
 */

// Anchos fijos (no al azar): el esqueleto se ve igual en cada carga y en los tests.
const ANCHOS = ['72%', '48%', '60%', '38%', '66%', '54%', '44%'];

const EsqueletoLista = ({
    columnas, claveGuardado, facetas = [], agrupables = [], buscar = true, filas = 8,
    label = 'Cargando la lista…', className,
}) => {
    const { visibles } = useColumnasVisibles(claveGuardado, columnas);
    const plantilla = visibles.map((c) => c.width || 'minmax(0,1fr)').join(' ');
    const pastillas = [facetas.length > 0 && 177, 178, agrupables.length > 0 && 153].filter(Boolean);

    return (
        <Skeleton label={label} className={className ? `lista-configurable ${className}` : 'lista-configurable'}>
            <div className="fila barra-tabla" aria-hidden="true">
                {pastillas.map((ancho, i) => <SkeletonBlock key={i} width={ancho} height={38} radius={999} step={i} />)}
                {buscar && <SkeletonBlock width={190} height={38} radius={999} step={pastillas.length} />}
                <span className="barra-cuenta"><SkeletonBlock width={120} height={10} step={pastillas.length + 1} /></span>
            </div>
            <div className="tabla lc-tabla" aria-hidden="true">
                <div className="tabla-cab" style={{ '--cols': plantilla }}>
                    {visibles.map((c) => (
                        <span key={c.key} className={`cab-celda${c.alinear === 'der' ? ' lc-der' : ''}`}>
                            <span className="trunc">{c.header}</span>
                        </span>
                    ))}
                </div>
                {Array.from({ length: filas }, (_, i) => (
                    <div key={i} className="tabla-fila" style={{ '--cols': plantilla }}>
                        {visibles.map((c, k) => (
                            <div key={c.key} className={c.alinear === 'der' ? 'lc-der' : undefined}
                                style={c.alinear === 'der' ? { display: 'flex', justifyContent: 'flex-end' } : undefined}>
                                <SkeletonBlock height={10} width={ANCHOS[(i + k) % ANCHOS.length]} step={i + k} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </Skeleton>
    );
};

export default EsqueletoLista;
