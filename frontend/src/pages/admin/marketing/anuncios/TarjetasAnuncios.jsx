import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { List, LayoutGrid } from 'lucide-react';
import { clavesUnicas } from './clavesUnicas';
import { Chip } from '../../../../components/standard';
import { formatear } from './metricas';
import { tonoDeValor, valorDe } from './CeldasTabla';
import { embudoDe } from './tonos';
import '../../../../components/listas/listas.css';

/**
 * Rendimiento en tarjetas (Kerwin, 17/10/2026: «una vista de tarjetas, que el usuario decida cuál usar,
 * como en las listas de los closers»; y después: «que haya algún tipo de embudo en las tarjetas, y
 * colores para entender qué estoy viendo»).
 *
 * Cada tarjeta: el embudo entrantes → calificados → agendas → ventas con la conversión de cada paso, y
 * debajo el resto de las métricas elegidas para la tabla. Con «Colores», cada conversión y cada métrica
 * en verde o rojo contra el promedio de la tabla (`tonos.js`).
 *
 * Tocar la cabecera hace lo mismo que la fila: en Anuncios la elige para el gráfico y el CSV; en
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

const EN_EL_EMBUDO = new Set(['entrantes', 'calificados', 'agendas', 'ventas']);
const pct = (v) => `${Math.round(v * 1000) / 10}%`;

const Embudo = ({ fila, totales, colores }) => {
    const quieto = useReducedMotion();
    return (
        <ol className="mk-embudo-mini" aria-label={`Embudo de ${fila.nombre}`}>
            {embudoDe(fila, totales).map((paso, i) => (
                <li key={paso.key}>
                    <small>{paso.label}</small>
                    <span className="mk-embudo-pista" aria-hidden="true">
                        <motion.i style={{ '--i': i }}
                            initial={quieto ? false : { width: 0 }}
                            animate={{ width: `${Math.max(paso.valor ? 2 : 0, paso.ancho * 100)}%` }}
                            transition={{ duration: quieto ? 0 : 0.5, delay: quieto ? 0 : i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <b className="num">{formatear(paso.valor, 'num')}</b>
                    <span className={`mk-embudo-conv num${colores && paso.tono ? ` mk-tono mk-tono--${paso.tono}` : ''}`}
                        title={paso.conversion !== null && paso.referencia
                            ? `Del paso anterior: ${pct(paso.conversion)}. En toda la tabla: ${pct(paso.referencia)}.${paso.key === 'ventas' ? ' Ventas = pagos, no personas.' : ''}` : undefined}>
                        {paso.conversion === null ? '' : pct(paso.conversion)}
                    </span>
                </li>
            ))}
        </ol>
    );
};

const TarjetasAnuncios = ({ filas, piezas, moneda, idDe, elegidas, onTocar, subtitulo, refs, totales, nivel }) => {
    const cols = piezas.flatMap((p) => (p.tipo === 'col' ? [p.col] : p.cols)).filter((c) => !EN_EL_EMBUDO.has(c.key));
    const claves = useMemo(() => clavesUnicas(filas, idDe), [filas, idDe]);
    const accion = nivel === 'anuncios' ?'Elegir para el gráfico' : nivel === 'campanas' ? 'Ver sus conjuntos' : 'Ver sus palabras clave';
    return (
        <div className="tarjetas mk-tarjetas">
            {filas.map((f, i) => {
                const elegida = elegidas.has(idDe(f));
                return (
                    <article key={claves[i]}className={`mk-tarjeta${elegida ? ' is-on' : ''}${f.archivado ? ' is-archivada' : ''}`}>
                        <button type="button" className="mk-tarjeta-cab" onClick={() => onTocar(f)}
                            aria-pressed={nivel === 'anuncios' ? elegida : undefined}
                            aria-label={`${f.nombre}: ${accion}`} title={accion}>
                            <span className="mk-tarjeta-nom">
                                <b>{f.nombre}</b>
                                {subtitulo(f) && <span className="t-cap mut40">{subtitulo(f)}</span>}
                            </span>
                            <span className="mk-tarjeta-chips">
                                {elegida && <Chip color="var(--brand-secondary)">Elegida</Chip>}
                                {f.archivado && <Chip color="var(--idle)">Archivada</Chip>}
                            </span>
                        </button>
                        <Embudo fila={f} totales={totales} colores={!!refs} />
                        {cols.length > 0 && (
                            <dl className="mk-tarjeta-datos">
                                {cols.map((c) => {
                                    const { className, title } = tonoDeValor(f, c.key, refs, moneda);
                                    return (
                                        <div key={c.key} title={title}>
                                            <dt>{c.label}</dt>
                                            <dd className={className}>
                                                {valorDe(f, c, moneda)}
                                                {c.pct && f[c.pct] != null && <small>{formatear(f[c.pct], 'pct')}</small>}
                                            </dd>
                                        </div>
                                    );
                                })}
                            </dl>
                        )}
                    </article>
                );
            })}
        </div>
    );
};

export default TarjetasAnuncios;
