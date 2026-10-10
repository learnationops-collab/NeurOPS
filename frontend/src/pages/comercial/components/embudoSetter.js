/**
 * El embudo de punta a punta del setter, listo para `FlujoEmbudo`: lo comparten «Mis datos» del
 * setter y los embudos de Comparativas, así un setter ve su embudo igual en las dos pantallas.
 *
 * El backend manda las etapas (`setter_mis_datos.embudo_de`) con su `fuente`: lo que cargó el setter
 * en el reporte o lo que registra el sistema. Acá solo se les pone el color —lavanda el reporte,
 * verde el sistema, como la leyenda— y el de cada canal a las partes de las agendas.
 */

export const COLOR_FUENTE = { reporte: 'var(--ch-tot)', sistema: 'var(--ch-sis)' };
export const COLOR_CANAL = { anuncios: 'var(--ch-ads)', inbound: 'var(--ch-inb)', sin_canal: 'var(--idle)' };
export const NOMBRE_CANAL = { anuncios: 'Anuncios', inbound: 'Inbound', sin_canal: 'Sin canal' };

export const AYUDA_ETAPA = {
    entrantes: 'Del reporte: los mensajes nuevos de cada día, de anuncios e inbound.',
    cualificados: 'Del reporte: entrantes menos no leads e in-abribles.',
    dolor: 'Del reporte: conversaciones que llegaron a identificar el dolor.',
    oferta: 'Del reporte: a quiénes se les presentó la oferta.',
    link: 'Del reporte: a quiénes se les mandó el link de la agenda.',
    agendas: 'Del reporte: las agendas cargadas cada día, por canal.',
    generadas: 'Del sistema: agendas reservadas en el período, por fecha de creación y una por persona.',
    asistieron: 'Del sistema: de esas agendas, las que se presentaron a la llamada.',
    ventas: 'Del sistema: ventas (pago completo o split pay) salidas de esas agendas.',
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
