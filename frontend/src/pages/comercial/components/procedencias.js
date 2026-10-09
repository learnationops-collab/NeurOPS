/**
 * Qué es cada procedencia de un cobro, para el «i» de cada fila. Los baldes los arma el backend
 * (`procedencia_ingresos_service`) y se dibujan en dos lugares: Finanzas › Resumen («Ingresos por
 * procedencia», en neto) y Analizar del dashboard comercial («Ingresos por fuente», en bruto, desde
 * el 09/10/2026). La explicación es una sola para que las dos pantallas digan lo mismo.
 */
export const AYUDA_PROCEDENCIA = {
    workshop: 'La clase en vivo y la grabación de la landing. Son el mismo workshop: suman juntas, y en el detalle se ve cuánto aportó cada una.',
    setting: 'Las agendas que consiguió cada setter. «Sin identificar» es el link de un setter que no dejó su nombre.',
    vsl: 'Las agendas que entraron por el embudo de la VSL.',
    fulfillment: 'Renovaciones y upsells, que los trae Fulfillment y no un embudo, más los pagos de sus agendas.',
    sin_procedencia: 'Pagos sin una agenda que los origine, o con una fuente que no es ninguna de las de arriba.',
};
