import { ArrowDown, ArrowUp } from 'lucide-react';
import { Tip } from '../../../comercial/components/Shared';
import { formatear } from './metricas';
import { REFERENCIA, explicacion, tonoDe } from './tonos';
import { COLUMNAS_TABLA, CORTO } from './columnasTabla';

/**
 * Las celdas y los encabezados de la tabla de Rendimiento: una métrica sola o un grupo juntado
 * (`columnasTabla.piezasDeLaTabla`), con el borde para cambiar el ancho (17/10/2026).
 */

export const Flecha = ({ orden, clave }) => {
    if (orden.clave !== clave) return null;
    return orden.dir === 'desc' ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />;
};

// Un gasto en cero de una palabra clave sin anuncio en Meta no es un dato medido: «—», no «$0.00».
const sinMedir = (fila, col) => col.key === 'gasto' && !fila.gasto
    && (fila.meta ? !fila.meta.anuncios : fila.medido === false);

export const valorDe = (fila, col, moneda) => (sinMedir(fila, col) ? '—' : formatear(fila[col.key], col.formato, moneda));

/** El borde derecho de un encabezado: arrastrarlo cambia el ancho; doble clic o Supr vuelve al de siempre. */
export const Borde = ({ id, etiqueta, vista }) => {
    const teclas = (e) => {
        const paso = e.shiftKey ? 48 : 16;
        if (e.key === 'ArrowLeft') vista.ponerAncho(id, vista.ancho(id) - paso);
        else if (e.key === 'ArrowRight') vista.ponerAncho(id, vista.ancho(id) + paso);
        else if (e.key === 'Delete' || e.key === 'Backspace') vista.ponerAncho(id, null);
        else return;
        e.preventDefault();
    };
    return (
        <span className="mk-redim" role="separator" aria-orientation="vertical" tabIndex={0}
            aria-label={`Ancho de ${etiqueta}`} aria-valuenow={vista.ancho(id)}
            title="Arrastrá para cambiar el ancho. Doble clic: el de siempre"
            onPointerDown={(e) => vista.arrastre.empezar(id, e)} onPointerMove={vista.arrastre.mover}
            onPointerUp={vista.arrastre.soltar} onPointerCancel={vista.arrastre.soltar}
            onDoubleClick={() => vista.ponerAncho(id, null)} onKeyDown={teclas} />
    );
};

export const Encabezado = ({ pieza, orden, ordenarPor, ariaOrden, vista }) => {
    if (pieza.tipo === 'col') {
        const c = pieza.col;
        return (
            <th scope="col" className="mk-num" aria-sort={ariaOrden(c.key)}>
                <span className="mk-cab-celda">
                    <Tip texto={c.ayuda} titulo={c.label} />
                    <button type="button" className="mk-cab" onClick={() => ordenarPor(c.key, c.menor)}>
                        {c.label} <Flecha orden={orden} clave={c.key} />
                    </button>
                </span>
                <Borde id={pieza.key} etiqueta={c.label} vista={vista} />
            </th>
        );
    }
    // Un grupo: su nombre y, debajo, cada métrica como botón para ordenar por ella.
    const ordenada = pieza.cols.find((c) => c.key === orden.clave);
    return (
        <th scope="col" className="mk-col-grupo" aria-sort={ordenada ? ariaOrden(ordenada.key) : 'none'}>
            <span className="mk-grupo-tit">{pieza.grupo.label}</span>
            <span className="mk-grupo-orden" aria-label={`Ordenar ${pieza.grupo.label} por`}>
                {pieza.cols.map((c) => (
                    <button key={c.key} type="button" className={`mk-grupo-por${orden.clave === c.key ? ' is-on' : ''}`}
                        title={`${c.label}: ${c.ayuda}`} onClick={() => ordenarPor(c.key, c.menor)}>
                        {CORTO[c.key]} <Flecha orden={orden} clave={c.key} />
                    </button>
                ))}
            </span>
            <Borde id={pieza.key} etiqueta={pieza.grupo.label} vista={vista} />
        </th>
    );
};

/** La referencia escrita como la métrica: un porcentaje, un monto o un número (para el `title`). */
const textoReferencia = (moneda) => (valor, key) => {
    const col = COLUMNAS_TABLA.find((c) => c.key === key);
    if (REFERENCIA[key]?.campo) return formatear(Math.round(valor * 10) / 10, 'pct');
    if (col.formato === 'num') return formatear(Math.round(valor * 10) / 10, 'num');
    return formatear(valor, col.formato, moneda);
};

/** Lo que lleva un valor con color: la clase del tono y su explicación. Sin `refs` (los totales,
 *  o con los colores apagados), nada. */
export const tonoDeValor = (fila, key, refs, moneda) => {
    const tono = refs ? tonoDe(fila, key, refs) : null;
    return tono ? { className: `mk-tono mk-tono--${tono}`, title: explicacion(fila, key, refs, textoReferencia(moneda)) } : {};
};

export const Celda = ({ fila, pieza, moneda, refs }) => {
    if (pieza.tipo === 'col') {
        const col = pieza.col;
        const { className, title } = tonoDeValor(fila, col.key, refs, moneda);
        return (
            <td className="mk-num num" title={title}>
                <span className={`mk-valor${className ? ` ${className}` : ''}`}>{valorDe(fila, col, moneda)}</span>
                {col.pct && <span className="mk-pct">{formatear(fila[col.pct], 'pct')}</span>}
            </td>
        );
    }
    return (
        <td className="mk-col-grupo num">
            <dl className="mk-grupo">
                {pieza.cols.map((col) => {
                    const { className, title } = tonoDeValor(fila, col.key, refs, moneda);
                    return (
                        <div key={col.key} title={title}>
                            <dt>{CORTO[col.key]}</dt>
                            <dd className={className}>
                                {valorDe(fila, col, moneda)}
                                {col.pct && fila[col.pct] != null && <small>{formatear(fila[col.pct], 'pct')}</small>}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </td>
    );
};
