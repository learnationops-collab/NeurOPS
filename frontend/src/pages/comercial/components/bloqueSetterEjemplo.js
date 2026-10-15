/**
 * Un bloque de setters para los tests, con la forma de `setter_analitica.bloque` (el `actual` de
 * `GET /comercial/resumen` con Setters), armado sobre `generadas`: las filas de Revisar › Agendas
 * del setter. Lo de después de la agenda se cuenta sobre esas mismas filas, así un test puede tocar
 * un número y comparar con lo que la lista muestra.
 */

const chip = (key, label, tone = 'idle') => ({ key, label, tone });
const POST = {
    pendiente: chip('pendiente', 'Pendiente'), cancelo: chip('cancelo', 'Canceló'),
    reagendo: chip('reagendo', 'Reagendó', 'info'), no_show: chip('no_show', 'No show', 'error'),
    seguimiento: chip('seguimiento', 'Seguimiento', 'warning'), venta: chip('venta', 'Venta', 'success'),
};
const ASISTIO = ['seguimiento', 'venta'];

/** Una agenda generada con su resultado (una clave de `POST`). */
export const generada = (id, post = 'pendiente', extra = {}) => ({
    tipo: 'agenda', id, client_id: 100 + id, creada: '2026-10-02T12:00:00', fecha: '2026-10-05T15:00:00',
    cliente: `Agenda ${id}`, ig: '', email: '', telefono: '', fuente: 'Setter', palabra_clave: '',
    closer: 'Marlon', closer_id: 3, setter: 'Ana Setter', setter_id: 7,
    pre_call: chip('confirmada', 'Confirmada', 'info'), post_call: POST[post],
    asistio: ASISTIO.includes(post), realizada: [...ASISTIO, 'no_show'].includes(post),
    no_cerrada: post === 'seguimiento', presento: post === 'venta', retraso_dias: 0, ya_paso: true,
    descartada: post === 'cancelo', ...extra,
});

export const GENERADAS = [
    generada(1, 'venta'), generada(2, 'seguimiento'), generada(3, 'seguimiento'), generada(4, 'no_show'),
    generada(5, 'cancelo'), generada(6, 'reagendo'), generada(7, 'pendiente'),
];

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

const vista = ({ entrantes, no_lead, inabribles, ap_entrantes, ap_dolor, agendas }, link = null) => {
    const cualificados = entrantes - no_lead - inabribles;
    const aperturas = ap_entrantes + ap_dolor;
    return {
        entrantes, no_lead, inabribles, cualificados, ap_entrantes, ap_dolor, aperturas, agendas,
        cualificacion: pct(cualificados, entrantes), no_lead_pct: pct(no_lead, entrantes),
        inabribles_pct: pct(inabribles, entrantes), apertura: pct(aperturas, entrantes),
        conversion: pct(agendas, entrantes), conv_cualificados: pct(agendas, cualificados),
        link, conv_link: link === null ? null : pct(agendas, link),
    };
};

/** El bloque. `respondidos` ({ entrantes, dolor, oferta, link }) simula lo que agrega el reporte. */
export const bloqueSetterEjemplo = ({ filas = GENERADAS, respondidos = null } = {}) => {
    const anuncios = vista({ entrantes: 60, no_lead: 10, inabribles: 2, ap_entrantes: 20, ap_dolor: 10, agendas: 6 });
    const inbound = vista({ entrantes: 30, no_lead: 4, inabribles: 2, ap_entrantes: 8, ap_dolor: 4, agendas: 3 });
    const general = vista({ entrantes: 90, no_lead: 14, inabribles: 4, ap_entrantes: 28, ap_dolor: 14, agendas: 9 }, 12);
    const n = (cond) => filas.filter(cond).length;
    const generadas = filas.length;
    const realizadas = n(f => f.realizada);
    const asistieron = n(f => f.asistio);
    const ventas = n(f => f.post_call.key === 'venta');
    const hechos = { entrantes: 40, dolor: 12, oferta: 6, link: 4 };
    const etapasFu = Object.entries(hechos).map(([key, h]) => ({
        key, hechos: h, respondidos: respondidos ? respondidos[key] : null,
        respuesta: respondidos ? pct(respondidos[key], h) : null,
    }));
    const despues = {
        generadas, canceladas: n(f => f.post_call.key === 'cancelo'), reagendadas: n(f => f.post_call.key === 'reagendo'),
        realizadas, no_show: n(f => f.post_call.key === 'no_show'), asistieron, ventas_originadas: ventas,
        senas: 0,
    };
    // Las que ya se dieron (15/10/2026): la llamada pasó, o se canceló o reagendó.
    const ocurridas = filas.filter(f => f.ya_paso || ['cancelo', 'reagendo'].includes(f.post_call.key));
    Object.assign(despues, {
        ocurridas: ocurridas.length, por_venir: generadas - ocurridas.length,
        sin_reporte: ocurridas.filter(f => f.post_call.key === 'pendiente').length,
    });
    Object.assign(despues, {
        canceladas_pct: pct(despues.canceladas, despues.ocurridas), reagendadas_pct: pct(despues.reagendadas, despues.ocurridas),
        no_show_pct: pct(despues.no_show, realizadas), show_up: pct(asistieron, realizadas), cierre: pct(ventas, asistieron),
    });
    const etapas = [
        ['entrantes', 'Entrantes', 'reporte', 90], ['cualificados', 'Cualificados', 'reporte', 72],
        ['dolor', 'Dolor', 'reporte', 30], ['oferta', 'Oferta', 'reporte', 18], ['link', 'Link', 'reporte', 12],
        ['agendas', 'Agendas', 'reporte', 9], ['generadas', 'Generadas', 'sistema', generadas],
        ['asistieron', 'Asistieron', 'sistema', asistieron], ['ventas', 'Ventas', 'sistema', ventas],
    ];
    return {
        ...general,
        canales: { anuncios, inbound },
        sin_canal: { entrantes: 0, no_lead: 0, inabribles: 0, cualificados: 0, ap_entrantes: 0, ap_dolor: 0,
            aperturas: 0, agendas: 0, apertura: null },
        reportes: 3, reportes_v2: 3, no_laborables: 0,
        embudo: { dolor: 30, oferta: 18, link: 12 },
        bienvenidas: { hechas: 20, respondidas: 8, aperturas: 5, respuesta: 40, apertura: 62.5 },
        bienvenidas_respuesta: 40,
        followups: { etapas: etapasFu, total: 62, respondidos: respondidos ? Object.values(respondidos).reduce((a, b) => a + b, 0) : null,
            respuesta: respondidos ? pct(Object.values(respondidos).reduce((a, b) => a + b, 0), 62) : null },
        followups_total: 62,
        ...despues,
        funnel: etapas.map(([key, label, fuente, valor], i) => ({
            key, label, fuente, n: valor, tasa: i ? pct(valor, etapas[i - 1][3]) : null,
            ...(key === 'generadas' ? { cruce: true } : {}),
            ...(key === 'agendas' ? { partes: [{ key: 'anuncios', n: 6 }, { key: 'inbound', n: 3 }, { key: 'sin_canal', n: 0 }] } : {}),
        })),
        dias: { habiles: 5, periodo: 7, reportados: 3, no_laborables: 0, en_fin_de_semana: 0,
            detalle: [{ fecha: '2026-10-05', estado: 'reportado' }, { fecha: '2026-10-06', estado: 'falta' }] },
        wins: [{ fecha: '2026-10-09', texto: 'Cerré 6 agendas en el día' }],
    };
};

/** La respuesta entera de `GET /comercial/resumen` con Setters. */
export const resumenSetterEjemplo = (opciones = {}) => ({
    rol: 'setters', actual: bloqueSetterEjemplo(opciones), previo: null,
    deltas: { entrantes: { valor: 12.5, modo: 'pct' } },
    deltas_canales: { anuncios: { entrantes: { valor: -4, modo: 'pct' } }, inbound: {} },
    comision: { role: 'setter', month: '2026-10', rate: 0.08, cash_neto: 1000, commission: 80 },
    miembro: { id: 7, nombre: 'Ana Setter' },
    dates: { start: '2026-10-01', end: '2026-10-31', compare_start: null, compare_end: null },
});
