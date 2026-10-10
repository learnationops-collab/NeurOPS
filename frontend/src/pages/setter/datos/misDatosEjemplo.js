/** Una respuesta de `GET /comercial/setter/mis-datos` para los tests (forma de `setter_mis_datos.mis_datos`). */
const canal = (extra) => ({ entrantes: 0, no_lead: 0, inabribles: 0, ap_entrantes: 0, ap_dolor: 0, agendas: 0,
    cualificados: 0, aperturas: 0, cualificacion: null, apertura: null, ...extra });

export const misDatosEjemplo = (cambios = {}) => ({
    rol: 'setters',
    miembro: { id: 7, nombre: 'Elias' },
    reporte: {
        reportes: 3, no_laborables: 0, reportes_v2: 2,
        canales: {
            anuncios: canal({ entrantes: 60, no_lead: 10, inabribles: 2, ap_entrantes: 20, ap_dolor: 10, agendas: 6,
                cualificados: 48, aperturas: 30, cualificacion: 80, apertura: 50 }),
            inbound: canal({ entrantes: 30, no_lead: 4, inabribles: 2, ap_entrantes: 8, ap_dolor: 4, agendas: 3,
                cualificados: 24, aperturas: 12, cualificacion: 80, apertura: 40 }),
        },
        sin_canal: canal(),
        bienvenidas: { hechas: 20, respondidas: 8, aperturas: 5 },
        totales: { entrantes: 90, no_lead: 14, inabribles: 4, cualificados: 72, ap_entrantes: 28, ap_dolor: 14,
            aperturas: 42, agendas: 9 },
        embudo: { cualificados: 72, dolor: 30, oferta: 18, link: 12, agendas: 9 },
        followups: { entrantes: 40, dolor: 12, oferta: 6, link: 4 },
        tasas: { cualificacion: 80, apertura: 46.7, bienvenidas_respuesta: 40, bienvenidas_apertura: 62.5,
            conversion: 12.5 },
        followups_total: 62,
    },
    sistema: { leads: 70, agendaron: 5, generadas: 7, realizadas: 5, asistieron: 4, show_up: 80, ventas: 1, senas: 0 },
    embudo: [
        ['entrantes', 'Entrantes', 'reporte', 90], ['cualificados', 'Cualificados', 'reporte', 72],
        ['dolor', 'Dolor', 'reporte', 30], ['oferta', 'Oferta', 'reporte', 18], ['link', 'Link', 'reporte', 12],
        ['agendas', 'Agendas', 'reporte', 9], ['generadas', 'Generadas', 'sistema', 7],
        ['asistieron', 'Asistieron', 'sistema', 4], ['ventas', 'Ventas', 'sistema', 1],
    ].map(([key, label, fuente, n]) => ({ key, label, fuente, n, tasa: null,
        ...(key === 'generadas' ? { cruce: true } : {}),
        ...(key === 'agendas' ? { partes: [{ key: 'anuncios', n: 6 }, { key: 'inbound', n: 3 }, { key: 'sin_canal', n: 0 }] } : {}) })),
    contraste: [
        { key: 'agendas', label: 'Agendas', reportado: 9, sistema: 7, diferencia: 2, definicion: 'Agendas generadas…' },
        { key: 'entrantes', label: 'Entrantes', reportado: 90, sistema: 70, diferencia: 20, definicion: 'Leads de ManyChat…' },
    ],
    dias: { habiles: 5, periodo: 7, reportados: 3, no_laborables: 0, en_fin_de_semana: 0,
        detalle: [{ fecha: '2026-10-05', estado: 'reportado' }, { fecha: '2026-10-06', estado: 'falta' }] },
    wins: [{ fecha: '2026-10-09', texto: 'Cerré 6 agendas en el día' }],
    comision: { role: 'setter', month: '2026-10', rate: 0.08, cash_neto: 1000, commission: 80 },
    previo: null,
    deltas: {},
    dates: { start: '2026-10-01', end: '2026-10-07', compare_start: null, compare_end: null },
    ...cambios,
});
