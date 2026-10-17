import { List, LayoutGrid } from 'lucide-react';
import { Chip } from '../../../../components/standard';
import VistaTarjetas from '../../../../components/listas/VistaTarjetas';
import { formatear } from './metricas';
import { valorDe } from './CeldasTabla';

/**
 * Rendimiento en tarjetas (Kerwin, 17/10/2026: «una vista de tarjetas, que el usuario decida cuál usar,
 * como en las listas de los closers»). Es la `VistaTarjetas` de Revisar: cada fila con sus métricas
 * rotuladas, las mismas columnas que se eligieron para la tabla y en su orden.
 *
 * Tocar una tarjeta hace lo mismo que la fila: en Anuncios la elige para el gráfico y el CSV; en
 * Campañas y Conjuntos baja al nivel siguiente.
 */

/** Lista o tarjetas: el mismo control de dos posiciones que Revisar. */
export const SelectorModo = ({ modo, setModo }) => (
    <div className="seg" role="group" aria-label="Forma de ver la tabla">
        <button type="button" aria-pressed={modo === 'lista'} title="Ver como tabla" aria-label="Ver como tabla"
            onClick={() => setModo('lista')}>
            <List size={14} />
        </button>
        <button type="button" aria-pressed={modo === 'tarjetas'} title="Ver como tarjetas" aria-label="Ver como tarjetas"
            onClick={() => setModo('tarjetas')}>
            <LayoutGrid size={14} />
        </button>
    </div>
);

const TarjetasAnuncios = ({ filas, piezas, moneda, idDe, elegidas, onTocar, subtitulo }) => {
    const cols = piezas.flatMap((p) => (p.tipo === 'col' ? [p.col] : p.cols));
    return (
        <div className="mk-tarjetas">
            <VistaTarjetas filas={filas} clave={idDe} titulo={(f) => f.nombre} subtitulo={subtitulo}
                onAbrir={onTocar}
                chips={(f) => (
                    <>
                        {elegidas.has(idDe(f)) && <Chip color="var(--brand-secondary)">Elegida</Chip>}
                        {f.archivado && <Chip color="var(--idle)">Archivada</Chip>}
                    </>
                )}
                campos={(f) => cols.map((c) => ({
                    rotulo: c.label,
                    valor: c.pct && f[c.pct] != null
                        ? `${valorDe(f, c, moneda)} · ${formatear(f[c.pct], 'pct')}`
                        : valorDe(f, c, moneda),
                }))} />
        </div>
    );
};

export default TarjetasAnuncios;
