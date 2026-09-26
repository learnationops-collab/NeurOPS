/**
 * Payloads de ejemplo de `GET /api/ficha/lead`, uno por estado del lead.
 *
 * El blueprint `/api/ficha` lo escribe otro agente en paralelo: estos fixtures son
 * el contrato de §12 congelado, y son con lo que se prueba el frontend hasta que el
 * endpoint exista. Los textos y los grupos salen del mockup
 * "Ficha Cliente confirmacion.dc.html".
 */

const VOCABULARIO = {
    etapas_confirmacion: [
        { clave: 'por_contactar', label: 'Por contactar' },
        { clave: 'contactado', label: 'Contactado' },
        { clave: 'horario', label: 'Horario' },
        { clave: 'videoask', label: 'VideoAsk' },
        { clave: 'testimonio', label: 'Testimonio' },
    ],
    como_viene: [
        { titulo: 'Respuesta', tono: 'info', opciones: [
            { clave: 'pendiente', label: 'Pendiente' },
            { clave: 'espera_respuesta', label: 'A la espera de respuesta' },
            { clave: 'no_contesta', label: 'No contesta' },
        ] },
        { titulo: 'Disposición', tono: 'success', opciones: [
            { clave: 'confirmo', label: 'Confirmó asistencia' },
            { clave: 'muy_interesado', label: 'Muy interesado' },
            { clave: 'con_dudas', label: 'Con dudas' },
        ] },
        { titulo: 'Alertas', tono: 'warning', opciones: [
            { clave: 'pidio_reprogramar', label: 'Pidió reprogramar' },
            { clave: 'dudas_plata', label: 'Dudas con la plata' },
            { clave: 'posible_no_show', label: 'Posible no show' },
        ] },
        { titulo: 'Otros', tono: 'idle', opciones: [] },
    ],
    dolores: [
        { titulo: 'Emocionales', tono: 'error', opciones: [
            { clave: 'ansiedad', label: 'Ansiedad' },
            { clave: 'estres', label: 'Estrés' },
            { clave: 'miedo_fracasar', label: 'Miedo a fracasar' },
        ] },
        { titulo: 'Hábitos', tono: 'warning', opciones: [
            { clave: 'procrastinacion', label: 'Procrastinación' },
            { clave: 'se_distrae', label: 'Se distrae' },
            { clave: 'desorganizacion', label: 'Desorganización' },
        ] },
        { titulo: 'Método', tono: 'info', opciones: [
            { clave: 'sin_metodo', label: 'Sin método' },
            { clave: 'intentos_previos', label: 'Intentos previos' },
            { clave: 'no_retiene', label: 'No retiene lo que estudia' },
        ] },
        { titulo: 'Otros', tono: 'idle', opciones: [] },
    ],
    motivos_descarte: [
        { titulo: 'Económicos', tono: 'error', opciones: [
            { clave: 'no_puede_pagar', label: 'No puede pagar' },
            { clave: 'caro', label: 'Le parece caro' },
        ] },
        { titulo: 'Tiempo y examen', tono: 'warning', opciones: [
            { clave: 'sin_tiempo', label: 'No tiene tiempo' },
            { clave: 'posterga', label: 'Posterga el examen' },
        ] },
        { titulo: 'Interés', tono: 'info', opciones: [
            { clave: 'no_buscaba', label: 'No era lo que buscaba' },
            { clave: 'otro_programa', label: 'Eligió otro programa' },
            { clave: 'dejo_responder', label: 'Dejó de responder' },
        ] },
        { titulo: 'Personales', tono: 'success', opciones: [
            { clave: 'salud', label: 'Salud' },
            { clave: 'familiares', label: 'Motivos familiares' },
        ] },
        { titulo: 'Otros', tono: 'idle', opciones: [] },
    ],
    motivos_baja: [
        { titulo: 'Económicos', tono: 'error', opciones: [
            { clave: 'no_puede_pagar', label: 'No puede pagar' },
            { clave: 'perdio_ingresos', label: 'Perdió ingresos' },
        ] },
        { titulo: 'Programa', tono: 'info', opciones: [
            { clave: 'sin_resultados', label: 'No ve resultados' },
            { clave: 'otro_programa', label: 'Se va a otro programa' },
        ] },
        { titulo: 'Otros', tono: 'idle', opciones: [] },
    ],
    pre_call: [{ clave: 'confirmado', label: 'Confirmado' }],
    post_call: [{ clave: 'venta', label: 'Venta' }, { clave: 'no_show', label: 'No show' }],
    tipos_pago: [{ clave: 'completo', label: 'Pago completo' }, { clave: 'cuotas', label: 'Cuotas' }],
    medios_pago: [
        { clave: 'stripe', label: 'Stripe' },
        { clave: 'transferencia', label: 'Transferencia' },
        { clave: 'paypal', label: 'PayPal' },
        { clave: 'efectivo', label: 'Efectivo' },
    ],
    canales_seguimiento: [
        { clave: 'whatsapp', label: 'WhatsApp' },
        { clave: 'llamada', label: 'Llamada' },
        { clave: 'email', label: 'Email' },
    ],
    horas_agenda: ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00', '21:00'],
    closers: [
        { id: 7, nombre: 'Jean Carlo', pista: '4 llamadas hoy' },
        { id: 8, nombre: 'Valentina', pista: '2 llamadas hoy' },
        { id: 9, nombre: 'Matías', pista: '5 llamadas hoy' },
        { id: 10, nombre: 'Lucía', pista: 'Libre' },
    ],
};

const PERMISOS_TODO = {
    confirmar: true, reportar: true, cobrar: true,
    eliminar: true, reasignar: true, comentar: true,
};

/** Lead en precall: la ficha abre en Confirmación, a medio camino del stepper. */
export const fichaPrecall = {
    identidad: {
        client_id: 341, appointment_id: 9012,
        nombre: 'Kevin Encalada', email: 'kevin@example.com',
        telefono: '+593 99 515 7254', instagram: '@kevin.enc',
        examen: 'MIR / ENARM', programa: null, grupo: null, ingreso: '2026-09-18',
        llamada: { iso: '2026-09-25T18:00:00', fecha: '25 sep', hora: '18:00' },
        fuente: 'Webinar', closer: { id: 7, nombre: 'Jean Carlo' },
        setter: { id: 3, nombre: 'Paula' },
    },
    estado: {
        clave: 'precall_a_medias', etiqueta: 'A medio confirmar', tono: 'warning',
        pestanas: ['conf', 'resultado', 'hist', 'form', 'com'],
        pestana_por_defecto: 'conf',
    },
    confirmacion: {
        etapa: 'horario', cerrada: false,
        como_viene: 'pendiente', dolores: ['procrastinacion', 'ansiedad'],
        nota: '', recordatorio_previo: { activo: false, cuando: null },
    },
    resultado: {
        pre_call: { key: 'conversando', label: 'Conversando', tone: 'info' },
        post_call: null, con_decisor: null, oferta_presentada: null, reportada: false,
        venta: null,
        hitos: [
            { clave: 'confirmado', label: 'Confirmado', sub: 'Agenda confirmada', estado: 'hecho' },
            { clave: 'resultado', label: 'Resultado', sub: 'Sin reportar', estado: 'pendiente' },
            { clave: 'cierre', label: 'Cierre', sub: 'Pendiente', estado: 'pendiente' },
            { clave: 'deuda', label: 'Deuda', sub: 'Pendiente', estado: 'pendiente' },
            { clave: 'upsell', label: 'Upsell', sub: 'Renovación o upsell', estado: 'pendiente' },
        ],
    },
    cobro: {
        deuda: 0, pagado: 0, ultimo_pago: null,
        programa_code: null, programa_nombre: null, proxima_cuota: null, etapa: null,
        cuotas: [], pagos: [], estado_pagos: null,
    },
    historial: {
        agendas: [
            { fecha: '25 sep · 18:00', detalle: 'Llamada de venta · Google Meet · Jean Carlo',
              chip: { label: 'Próxima', tone: 'info' } },
            { fecha: '18 sep · 20:00', detalle: 'Pidió reprogramar por guardia · Jean Carlo',
              chip: { label: 'Reprogramó', tone: 'warning' } },
            { fecha: '11 sep · 19:00', detalle: 'Agenda desde webinar · Matías',
              chip: { label: 'No show', tone: 'error' } },
        ],
        seguimientos: [
            { fecha: '23 sep 2026', canal: 'WhatsApp',
              nota: 'Confirmó horario. Pidió que lo llamen después de las 20 h.' },
        ],
        eventos: [],
    },
    formulario: {
        fuente_form: 'Webinar MIR',
        respuestas: [
            { clave: 'examen', pregunta: '¿Qué examen rendís?', respuesta: 'MIR / ENARM' },
            { clave: 'cuando', pregunta: '¿Cuándo rendís?', respuesta: 'Septiembre 2027' },
            { clave: 'horas', pregunta: '¿Cuántas horas estudiás por día?', respuesta: 'Entre 4 y 6' },
            { clave: 'freno', pregunta: '¿Qué te frena hoy?',
              respuesta: 'Me cuesta arrancar y me distraigo con el celular.' },
            { clave: 'metodos', pregunta: '¿Probaste otros métodos?', respuesta: 'Sí, una academia en 2025.' },
        ],
        encuesta: [],
    },
    comunicacion: {
        notas: [
            { autor: 'Paula', rol: 'Setter', fecha: '22 sep 2026 · 16:36',
              texto: 'MIR 2028. Quiere reforzar conocimientos y dar el paso a una residencia. Le '
                  + 'preocupa la extensión de los temas. Estudia 2 horas por día.',
              notificados: ['Jean Carlo'] },
        ],
        equipo: [
            { id: 1, nombre: 'Dari', rol: 'Triage' },
            { id: 3, nombre: 'Paula', rol: 'Setter' },
            { id: 4, nombre: 'Elías', rol: 'Setter' },
            { id: 7, nombre: 'Jean Carlo', rol: 'Closer' },
            { id: 8, nombre: 'Valentina', rol: 'Closer' },
        ],
    },
    permisos: { ...PERMISOS_TODO },
    vocabulario: VOCABULARIO,
};

/** Agenda vencida sin reportar: abre en Resultado, que es donde está el trabajo. */
export const fichaSinReportar = {
    ...fichaPrecall,
    estado: {
        clave: 'vencida_sin_reportar', etiqueta: 'Pendiente · 2 d de retraso', tono: 'warning',
        pestanas: ['conf', 'resultado', 'hist', 'form', 'com'],
        pestana_por_defecto: 'resultado',
    },
    confirmacion: { ...fichaPrecall.confirmacion, etapa: 'testimonio', cerrada: true },
};

/** Venta cerrada con deuda: abre en Acciones, el cockpit de cobro. */
export const fichaConDeuda = {
    ...fichaPrecall,
    identidad: { ...fichaPrecall.identidad, programa: 'Elite', grupo: 'G-12' },
    estado: {
        clave: 'venta_con_deuda', etiqueta: 'Con deuda', tono: 'error',
        pestanas: ['resultado', 'acciones', 'hist', 'form', 'com'],
        pestana_por_defecto: 'acciones',
    },
    resultado: {
        ...fichaPrecall.resultado,
        post_call: { key: 'venta', label: 'Venta', tone: 'success' },
        con_decisor: true, oferta_presentada: true, reportada: true,
        venta: { id: 551, programa: 'Elite', tipo_pago: 'cuotas', monto: 2000,
            metodo: 'Stripe', fecha: '2026-09-25', estado: 'Parcial' },
        hitos: [
            { clave: 'confirmado', label: 'Confirmado', sub: 'Agenda confirmada', estado: 'hecho' },
            { clave: 'resultado', label: 'Resultado', sub: 'Asistió · con decisor', estado: 'hecho' },
            { clave: 'cierre', label: 'Cierre', sub: 'Venta cerrada', estado: 'hecho' },
            { clave: 'deuda', label: 'Deuda', sub: 'Con deuda', estado: 'alerta' },
            { clave: 'upsell', label: 'Upsell', sub: 'Ninguno', estado: 'pendiente' },
        ],
    },
    cobro: {
        deuda: 1000, pagado: 1000, ultimo_pago: '25 sep',
        programa_code: 'elite', programa_nombre: 'Elite',
        proxima_cuota: { fecha: '2026-10-25', monto: 500 }, etapa: 'cobro_parcial',
        cuotas: [
            { id: 1, numero: 1, monto: 500, fecha: '2026-10-25', estado: 'pendiente' },
            { id: 2, numero: 2, monto: 500, fecha: '2026-11-25', estado: 'pendiente' },
        ],
        pagos: [{ fecha: '25 sep 2026', medio: 'Stripe · seña de ingreso', monto: 1000, tipo: 'sena' }],
        estado_pagos: { al_dia: false, vencidas: 0 },
    },
};

/** Cliente al día: no hay nada que hacer, abre en Historial. */
export const fichaAlDia = {
    ...fichaConDeuda,
    estado: {
        clave: 'cliente_al_dia', etiqueta: 'Al día', tono: 'success',
        pestanas: ['resultado', 'acciones', 'hist', 'form', 'com'],
        pestana_por_defecto: 'hist',
    },
    cobro: { ...fichaConDeuda.cobro, deuda: 0, pagado: 2000, cuotas: [] },
};

/**
 * Payload a medias: claves en `null` y sin `permisos`. No es un estado del lead,
 * es el escenario de degradación que el frontend tiene que aguantar sin romperse.
 */
export const fichaIncompleta = {
    identidad: { nombre: 'Sin datos', appointment_id: 1, client_id: null, telefono: null,
        examen: null, llamada: null, closer: null },
    estado: { clave: null, etiqueta: null, tono: null, pestanas: null, pestana_por_defecto: null },
    confirmacion: null,
    resultado: null,
    cobro: null,
    historial: null,
    formulario: null,
    comunicacion: null,
    permisos: null,
    vocabulario: null,
};

/** Un setter solo comenta: no ve Resultado ni Acciones. */
export const fichaSoloLectura = {
    ...fichaPrecall,
    estado: { ...fichaPrecall.estado, pestana_por_defecto: 'resultado' },
    permisos: { confirmar: false, reportar: false, cobrar: false,
        eliminar: false, reasignar: false, comentar: true },
};

export default fichaPrecall;
