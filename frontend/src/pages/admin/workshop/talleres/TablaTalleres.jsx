import React, { useMemo, useState } from 'react';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { columnasDe, FACETAS_TALLERES, VISTAS_TALLERES } from './columnasTalleres';

/**
 * Los talleres en la lista estándar del sistema (`ListaConfigurable`), con el diseño de Kerwin (24/10/2026):
 * vistas de columnas (Embudo, Tráfico, Captación, Conversión, Plata, Todo), la fila «Total del período»
 * pegada bajo la cabecera, cada cifra coloreada contra ese total (20 % mejor o peor), el punto de ganancia
 * junto a la fecha y la columna principal ensanchable. Columnas elegibles (se recuerdan), filtro completo
 * por facetas, orden por columna y búsqueda; la fila abre el detalle. La casilla de comparar va en la celda
 * del taller, que es fija.
 */
export { FACETAS_TALLERES };

const subTotal = (filas) => {
    const conGanancia = filas.filter((e) => (e.cash_collected || 0) > (e.inversion || 0)).length;
    return `${filas.length} ${filas.length === 1 ? 'taller' : 'talleres'} · ${conGanancia} con ganancia`;
};

const Leyenda = () => (
    <div className="wt-leyenda t-cap mut" aria-label="Cómo leer la tabla">
        <span><i className="wt-leyenda-caja wt-leyenda-caja--si" />20 % mejor que el total del período · ROAS desde 1x · ganancia positiva</span>
        <span><i className="wt-leyenda-caja wt-leyenda-caja--no" />20 % peor</span>
        <span>El punto junto a la fecha marca si el taller dio ganancia.</span>
        <span>Close rate con menos de 5 asistencias: muestra chica, sin color.</span>
        <span>Tocá un encabezado para ordenar y arrastrá el borde de «Taller» para ensancharlo.</span>
    </div>
);

const TablaTalleres = ({ talleres, formatDate, elegidos, onComparar, onAbrir, extra }) => {
    const [comparar, setComparar] = useState(true);
    const columnas = useMemo(
        () => columnasDe({ formatDate, elegidos, onComparar, comparar }),
        [formatDate, elegidos, onComparar, comparar],
    );
    const botones = (
        <>
            {extra}
            <button type="button" className={`pastilla${comparar ? ' pastilla--on' : ''}`} aria-pressed={comparar}
                onClick={() => setComparar((c) => !c)}
                title="Colorea cada cifra según qué tan mejor o peor es que el total del período">
                Comparar con total: {comparar ? 'sí' : 'no'}
            </button>
        </>
    );
    return (
        <div className="wt-tabla">
            <ListaConfigurable columnas={columnas} facetas={FACETAS_TALLERES} filas={talleres} clave={(e) => e.id}
                onAbrirFila={(e) => onAbrir(e, 'embudo')} buscar={(e) => `${e.name} ${e.date}`}
                buscarPlaceholder="Buscar taller…" claveGuardado="workshop_talleres_columnas_v2"
                vacio="Ningún taller cumple el filtro." extra={botones} ordenInicial={{ key: 'taller', dir: 'desc' }}
                vistas={VISTAS_TALLERES} totales={{ etiqueta: 'Total del período', sub: subTotal }}
                ayuda="La fila abre el detalle; la casilla suma a comparar." />
            <Leyenda />
        </div>
    );
};

export default TablaTalleres;
