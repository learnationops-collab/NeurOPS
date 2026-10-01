/**
 * El período de "Mis datos" que corresponde a cada chip de fecha del mazo del setter.
 *
 * Los chips son los mismos rangos que esos períodos (ver `_rango_pedido` en
 * app/api/setter_mazo.py): "7 días" es hoy y los 6 anteriores, "30 días" hoy y los 29 anteriores.
 * Con esto el número de agendas generadas que muestra la lista de Agendas se pide al MISMO
 * endpoint y con el MISMO período que "Mis datos", y no puede dar otro.
 */
export const PERIODO_DE_MIS_DATOS = { today: 'hoy', yesterday: 'ayer', week: '7d', month: '30d' };

/** Los filtros de `getTabla` para ese chip, o null si no hay período (un día sin elegir). */
export const filtrosDeMisDatos = (dateRange, customDate) => {
    if (dateRange === 'custom') {
        return customDate ? { period: 'custom', compare: 'none', desde: customDate, hasta: customDate } : null;
    }
    const period = PERIODO_DE_MIS_DATOS[dateRange];
    return period ? { period, compare: 'none' } : null;
};
