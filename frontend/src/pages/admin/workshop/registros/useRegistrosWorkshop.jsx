import { useCallback, useRef } from 'react';
import { useVerRegistros } from '../../../../components/standard';
import CuerpoAgendasTaller from '../agendas/CuerpoAgendasTaller';
import { aggregateTotals } from '../funnelMath';
import ContenidoPorTaller from './ContenidoPorTaller';
import ContenidoRegistrosTaller from './ContenidoRegistrosTaller';
import { POR_TALLER, TITULOS } from './cuentas';

/**
 * «Ver registros» de las cifras de Workshop (ADR-W015): `abrir(lista, titulo)` abre el panel (lateral o central) con
 * la lista que suma esa cifra para `talleres`, y `panel` va una vez en el JSX de la pestaña. Las listas se arman
 * según la clave (ver `cuentas.js`): agendas con la tabla de Revisar, personas y cobros desde el backend, y lo que
 * se carga por taller (inversión, leads, pasos del embudo) taller por taller. `abrir(lista, titulo, [taller])` abre la lista
 * de un solo taller (la fila o la tarjeta que se tocó).
 */

// Lo que guardan los talleres de cada lista del backend: si la lista de hoy da otra cuenta, se avisa.
const GUARDADO = {
    agendas: (t) => t.agendas_exitosas, show_up: (t) => t.show_up_sales_call, reportadas: (t) => t.citas_reportadas,
    ventas: (t) => t.sales, new_cash: (t) => t.cash_ventas, cash_total: (t) => t.cash_collected,
};

const dia = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const subtituloDe = (talleres, formatDate) => {
    if (talleres.length === 1) return formatDate ? formatDate(talleres[0].date) : dia(talleres[0].date);
    const fechas = talleres.map((t) => t.date).sort();
    return `${talleres.length} talleres · del ${dia(fechas[0])} al ${dia(fechas[fechas.length - 1])}`;
};

export const useRegistrosWorkshop = (talleres, formatDate = null) => {
    const registros = useVerRegistros();
    const ultimos = useRef(talleres);
    ultimos.current = talleres;

    const abrir = useCallback((lista, titulo, de = null) => {
        const lote = de || ultimos.current || [];
        if (!lote.length) return;
        const ids = lote.map((t) => t.id);
        const nombre = titulo || TITULOS[lista] || lista;
        let contenido = null;
        if (lista === 'agendas') {
            contenido = <CuerpoAgendasTaller tallerIds={ids} titulo={nombre} esperado={aggregateTotals(lote).agendas_exitosas} />;
        } else if (POR_TALLER[lista]) {
            contenido = <ContenidoPorTaller talleres={lote} lista={lista} titulo={nombre} />;
        } else if (GUARDADO[lista]) {
            const guardado = lote.reduce((s, t) => s + (Number(GUARDADO[lista](t) ?? (lista === 'reportadas' ? t.agendas_exitosas : 0)) || 0), 0);
            contenido = <ContenidoRegistrosTaller ids={ids} metrica={lista} esperado={guardado} />;
        }
        if (!contenido) return;
        registros.abrir({ titulo: nombre, subtitulo: subtituloDe(lote, formatDate), contenido });
    }, [registros.abrir, formatDate]);

    return { abrir, panel: registros.panel };
};

export default useRegistrosWorkshop;
