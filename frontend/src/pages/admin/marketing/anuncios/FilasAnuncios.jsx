import { Archive, ArchiveRestore, ChevronRight, Pencil } from 'lucide-react';
import { Celda } from './CeldasTabla';
import { SIN_CAMPANA, textoMeta } from './metricas';

/** Las filas de la tabla de Rendimiento: una campaña o un conjunto (que baja al nivel siguiente) y una
 *  palabra clave (un anuncio), más la fila de resultados del pie. */

export const ORIGEN = { meta: 'Meta', manual: 'a mano', anterior: 'carga vieja' };

const Punto = ({ meta }) => {
    const estado = !meta?.anuncios ? 'sin' : meta.activos ? 'activo' : 'pausado';
    const titulo = { sin: 'Sin anuncio en Meta', activo: 'Con anuncios activos en Meta', pausado: 'Sus anuncios de Meta no están activos' }[estado];
    return <i className={`mk-punto mk-punto--${estado}`} title={titulo} aria-label={titulo} role="img" />;
};

const palabras = (n) => `${n} ${n === 1 ? 'palabra clave' : 'palabras clave'}`;

export const FilaGrupo = ({ g, nivel, elegida, onAlternar, onAbrir, piezas, moneda, refs }) => {
    const detalle = nivel === 'campanas'
        ? `${g.conjuntos} ${g.conjuntos === 1 ? 'conjunto' : 'conjuntos'} · ${palabras(g.palabras)}`
        : `${g.campana ?? SIN_CAMPANA} · ${palabras(g.palabras)}`;
    return (
        <tr className={elegida ? 'mk-fila--elegida' : ''}>
            <td className="mk-col-sel">
                <input type="checkbox" checked={elegida} onChange={() => onAlternar(g)} aria-label={`Elegir ${g.nombre}`} />
            </td>
            <td className="mk-col-nombre">
                <button type="button" className="mk-nombre mk-abrir" onClick={() => onAbrir(g)}
                    title={`Ver ${nivel === 'campanas' ? 'sus conjuntos' : 'sus palabras clave'}`}>
                    <div className="mk-nombre-txt">
                        <span className="mk-nombre-kw trunc" title={g.nombre}>{g.nombre}</span>
                        <span className="mk-nombre-sub trunc">
                            {detalle}{g.origenes.length === 1 && ` · ${ORIGEN[g.origenes[0]]}`}
                        </span>
                    </div>
                    <ChevronRight className="mk-abrir-flecha" size={15} aria-hidden="true" />
                </button>
            </td>
            {piezas.map((p) => <Celda key={p.key} fila={g} pieza={p} moneda={moneda} refs={refs} />)}
            <td className="mk-col-acc" />
        </tr>
    );
};

export const FilaAnuncio = ({ f, elegida, onAlternar, onEditar, onArchivar, subtitulo, piezas, moneda, refs }) => {
    const sub = subtitulo(f, textoMeta(f.meta));
    return (
        <tr className={`${elegida ? 'mk-fila--elegida' : ''}${f.archivado ? ' mk-fila--archivada' : ''}`}>
            <td className="mk-col-sel">
                <input type="checkbox" checked={elegida} onChange={() => onAlternar(f)}
                    aria-label={`Ver ${f.nombre} en el gráfico`} />
            </td>
            <td className="mk-col-nombre">
                <div className="mk-nombre">
                    <Punto meta={f.meta} />
                    <div className="mk-nombre-txt">
                        <span className="mk-nombre-kw trunc" title={f.nombre}>{f.nombre}</span>
                        {sub && <span className="mk-nombre-sub trunc" title={(f.meta?.nombres || []).join(' · ')}>{sub}</span>}
                        {f.clave !== null && (
                            <button type="button" className="mk-agrupar trunc" onClick={() => onEditar(f)}
                                title={f.agrupacion ? `Campaña y conjunto (${ORIGEN[f.agrupacion]}): cambiarlos` : 'Elegir campaña y conjunto'}>
                                <Pencil size={11} aria-hidden="true" />
                                {f.campana ? `${f.campana} › ${f.conjunto ?? 'Sin conjunto'}` : 'Sin campaña · elegir'}
                            </button>
                        )}
                    </div>
                    {f.archivado && <span className="chip mk-chip" style={{ '--c': 'var(--idle)' }}>Archivada</span>}
                </div>
            </td>
            {piezas.map((p) => <Celda key={p.key} fila={f} pieza={p} moneda={moneda} refs={refs} />)}
            <td className="mk-col-acc">
                {f.clave !== null && (
                    <button type="button" className="ibtn ibtn--sm"
                        title={f.archivado ? 'Volver a mostrar' : 'Archivar: esconderla de la tabla'}
                        aria-label={f.archivado ? `Volver a mostrar ${f.nombre}` : `Archivar ${f.nombre}`}
                        onClick={() => onArchivar(f, !f.archivado)}>
                        {f.archivado ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                    </button>
                )}
            </td>
        </tr>
    );
};

export const PieDeResultados = ({ cantidad, unidad, totales, piezas, moneda }) => (
    <tfoot>
        <tr className="mk-total">
            <td className="mk-col-sel" />
            <td className="mk-col-nombre">
                <span className="mk-total-rot">Resultados de {cantidad} {unidad}</span>
            </td>
            {piezas.map((p) => <Celda key={p.key} fila={totales} pieza={p} moneda={moneda} />)}
            <td className="mk-col-acc" />
        </tr>
    </tfoot>
);
