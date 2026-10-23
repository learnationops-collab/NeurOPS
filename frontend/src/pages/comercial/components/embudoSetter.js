/**
 * El embudo de punta a punta del setter, listo para `FlujoEmbudo`: lo comparten el tablero de setters
 * (`DashboardSetters`) y los embudos de Comparativas, así un setter ve su embudo igual en las dos.
 *
 * El backend manda las etapas (`setter_analitica.embudo_de`) con su `fuente`: lo que cargó el setter
 * en el reporte o lo que registra el sistema. Acá solo se les pone el color —lavanda el reporte,
 * verde el sistema, como la leyenda— y el de cada canal a las partes de las agendas.
 */

export const COLOR_FUENTE = { reporte: 'var(--ch-tot)', sistema: 'var(--ch-sis)' };
export const COLOR_CANAL = { anuncios: 'var(--ch-ads)', inbound: 'var(--ch-inb)', sin_canal: 'var(--idle)' };
export const NOMBRE_CANAL = { anuncios: 'Anuncios', inbound: 'Inbound', sin_canal: 'Sin canal' };

// Una línea por etapa (la burbuja del embudo): qué cuenta y de dónde sale, reporte o sistema.
export const AYUDA_ETAPA = {
    entrantes: 'Mensajes nuevos del día, de anuncios e inbound.',
    cualificados: 'Leads cualificados que cargó el setter.',
    dolor: 'Conversaciones donde se identificó el dolor.',
    oferta: 'A quiénes se les presentó la oferta.',
    link: 'A quiénes se les mandó el link de la agenda.',
    agendas: 'Agendas que el setter cargó en su reporte.',
    generadas: 'Agendas reservadas en el sistema, una por persona.',
    asistieron: 'De las generadas, las que se presentaron.',
    ventas: 'Pago completo o split pay salido de esas agendas.',
};

/**
 * Las etapas con su color y, si hay `irDe`, su drill-down. `irDe(etapa)` devuelve el `onClick` de
 * esa etapa o undefined (las del reporte no tienen lista).
 */
export const etapasParaDibujar = (etapas, irDe = null) => etapas.map(e => ({
    ...e,
    color: COLOR_FUENTE[e.fuente],
    ayuda: AYUDA_ETAPA[e.key],
    partes: e.partes?.map(p => ({ ...p, color: COLOR_CANAL[p.key] })),
    ir: irDe ? irDe(e) : undefined,
}));

/** De la primera etapa a la última, en %: «de 971 entrantes a 6 ventas». */
export const puntaAPunta = (etapas) => {
    const primera = etapas[0]?.n, ultima = etapas[etapas.length - 1]?.n;
    return primera ? Math.round((ultima / primera) * 1000) / 10 : null;
};
