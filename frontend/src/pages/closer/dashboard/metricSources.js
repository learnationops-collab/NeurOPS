/* Catálogo de procedencia de cada dato del dashboard del closer.
 *
 * Existe para que ningún número quede sin explicación de dónde salió: el dashboard mezcla cuatro
 * fuentes con reglas distintas, y esa mezcla es justamente la que produce los números que no
 * cierran (un close rate por encima del 100%, por ejemplo, sale de dividir ventas del registro
 * financiero — que cubre todo el período — por presentaciones de los reportes diarios, que solo
 * existen los días que el closer efectivamente reportó).
 *
 * Un solo lugar para editarlos: si cambia un cálculo en el backend, se corrige acá y queda
 * corregido en todas las tarjetas que lo muestran.
 */

export const SOURCE_STYLES = {
    reporte: { label: 'Reporte diario', color: '#A78BFA', short: 'Reporte' },
    agendas: { label: 'Agendas reales', color: '#38BDF8', short: 'Agendas' },
    ventas: { label: 'Registro financiero', color: '#34D399', short: 'Ventas' },
    cuotas: { label: 'Plan de cuotas', color: '#FBBF24', short: 'Cuotas' },
    derivado: { label: 'Calculado', color: '#94A3B8', short: 'Cálculo' }
};

export const SOURCE_LEGEND = [
    {
        key: 'reporte',
        title: 'Reporte diario',
        text: 'Lo que quedó guardado cada vez que enviaste el reporte del día. Si un día no lo enviaste, ese día no existe acá.'
    },
    {
        key: 'agendas',
        title: 'Agendas reales',
        text: 'Las citas del sistema, con su estado actual. No dependen de que hayas enviado el reporte.'
    },
    {
        key: 'ventas',
        title: 'Registro financiero',
        text: 'Los pagos cobrados, con su fecha real. Cubre el período completo, hayas reportado o no.'
    },
    {
        key: 'cuotas',
        title: 'Plan de cuotas',
        text: 'El cronograma de cobro de cada venta parcial. Es saldo histórico: no se filtra por período.'
    }
];

// Umbrales para colorear. Son los mismos que ya venían usando las alertas del backend y las
// tablas del dashboard — no son metas nuevas inventadas acá, solo centralizadas.
const B = {
    confirmation: { good: 70, warn: 50 },
    show: { good: 55, warn: 40 },
    pitch: { good: 70, warn: 50 },
    close: { good: 40, warn: 20 }
};

export const METRICS = {
    // ---------- KPIs principales ----------
    cash_collected: {
        title: 'Todo el dinero que entró a caja en el período',
        source: 'ventas',
        formula: 'PIF + Split + señas + cuotas + upsell/renovación + sin clasificar',
        note: 'Cobros con fecha dentro del período, atribuidos al closer por el mail del vendedor. Incluye plata de ventas viejas (cuotas), así que no se mueve igual que "Ventas cerradas".'
    },
    ventas: {
        title: 'Ventas nuevas cerradas',
        source: 'ventas',
        formula: 'pagos PIF (completo) + pagos Split (parcial)',
        note: 'Solo estos dos tipos abren una venta. La seña es una reserva, la cuota es el cobro de una venta anterior, y upsell/renovación son de clientes que ya habían comprado.'
    },
    ticket_promedio: {
        title: 'Cuánto se cobró en promedio por venta nueva',
        source: 'ventas',
        formula: 'cash de PIF + Split ÷ cantidad de ventas PIF + Split',
        note: 'Mismo criterio que "Ventas cerradas": cuotas, señas, upsells y renovaciones quedan fuera del promedio.'
    },
    deuda_total_pendiente: {
        title: 'Saldo que los clientes todavía deben',
        source: 'cuotas',
        formula: 'suma de las cuotas con estado distinto de "pagado"',
        note: 'Saldo histórico completo, NO filtrado por el período elegido arriba. Mirá el desglose vencido / por vencer en la sección Dinero.'
    },
    close_rate_llamada: {
        title: 'De cada llamada que asistió, cuántas terminaron en venta',
        source: 'derivado',
        formula: 'ventas (PIF + Split) ÷ asistencias',
        note: 'El numerador sale del registro financiero (período completo) y el denominador de los reportes diarios (solo días reportados).',
        benchmark: B.close
    },
    close_rate_presentacion: {
        title: 'De cada oferta presentada, cuántas terminaron en venta',
        source: 'derivado',
        formula: 'ventas (PIF + Split) ÷ presentaciones',
        note: 'Es el indicador más directo de tu cierre: mide solo las llamadas donde llegaste a presentar la oferta.',
        benchmark: B.close
    },
    seguimientos_hechos: {
        title: 'Seguimientos que registraste como contactados',
        source: 'reporte',
        formula: 'suma de follow_ups_sent de los reportes del período',
        note: 'Se cuenta cuando procesás una tarjeta de "③ Seguimientos" dejando el resultado del contacto.'
    },
    seguimientos_respondidos: {
        title: 'Seguimientos donde el lead contestó',
        source: 'reporte',
        formula: 'seguimientos con un resultado distinto de "no respondió"'
    },

    // ---------- Embudo ----------
    funnel_slots: {
        title: 'Cupos de agenda que abriste',
        source: 'reporte',
        formula: 'cupos ocupados + cupos que quedaron libres',
        note: 'Es el único número del reporte que se escribe a mano: el sistema no tiene dónde leer tu capacidad configurada. Nunca puede ser menor que tus agendas.'
    },
    funnel_agendas: {
        title: 'Llamadas agendadas',
        source: 'reporte',
        formula: 'primeras llamadas + segundas llamadas agendadas',
        note: 'Sale de los reportes diarios. Incluye el backlog de días anteriores que hayas procesado ese día, así que puede quedar por encima de las citas reales del período.'
    },
    funnel_confirmadas: {
        title: 'Agendas que llegaron a confirmarse',
        source: 'agendas',
        formula: 'citas del período con estado "Confirmado"',
        note: 'Se lee de las agendas reales, no del reporte diario (ahí no existe un campo de confirmaciones). Por eso no depende de que hayas enviado el reporte.'
    },
    funnel_asistencias: {
        title: 'Llamadas a las que el lead asistió',
        source: 'reporte',
        formula: 'llamadas cerradas como "Show up"'
    },
    funnel_presentaciones: {
        title: 'Llamadas donde presentaste la oferta',
        source: 'reporte',
        formula: 'asistencias con "presentó oferta" marcada al cerrar la llamada',
        note: 'Si al registrar el resultado de la llamada no marcás que presentaste la oferta, esa llamada no cuenta acá y tu close rate sale inflado.'
    },
    funnel_ventas: {
        title: 'Ventas nuevas del período',
        source: 'ventas',
        formula: 'pagos PIF (completo) + pagos Split (parcial)'
    },

    // ---------- Pérdidas ----------
    perdida_no_show: {
        title: 'Agendas donde el lead no apareció',
        source: 'reporte',
        formula: 'llamadas cerradas como "No Show" ÷ agendas'
    },
    perdida_cancelaciones: {
        title: 'Agendas canceladas antes de la llamada',
        source: 'reporte',
        formula: 'llamadas cerradas como "Cancelado" ÷ agendas'
    },
    perdida_reprogramaciones: {
        title: 'Agendas movidas a otra fecha',
        source: 'reporte',
        formula: 'llamadas cerradas como "Reagendado" ÷ agendas',
        note: 'Una reprogramación no es una pérdida definitiva, pero atrasa el cierre y suele terminar en no show.'
    },

    // ---------- Confirmaciones ----------
    confirm_periodo: {
        title: 'Confirmaciones de agendas de este período',
        source: 'agendas',
        formula: 'citas con fecha dentro del período y estado "Confirmado"',
        note: 'Son las que pertenecen a este embudo: su llamada ya pasó o pasa dentro del período.'
    },
    confirm_proximas: {
        title: 'Confirmaciones de agendas que todavía no llegaron',
        source: 'agendas',
        formula: 'citas con fecha POSTERIOR al período y estado "Confirmado"',
        note: 'Es pipeline hacia adelante, no rendimiento del período. Si se mezclara con lo de al lado, el confirmation rate quedaría inflado con trabajo cuya llamada todavía no pasó.'
    },

    // ---------- Calidad de la llamada ----------
    q_confirmation_rate: {
        title: 'De las agendas del período, cuántas confirmaste',
        source: 'derivado',
        formula: 'agendas confirmadas ÷ agendas reales del período',
        note: 'Numerador y denominador salen de las agendas reales, así que este número no se rompe si falta un reporte diario.',
        benchmark: B.confirmation
    },
    q_show_rate: {
        title: 'De las llamadas que ya se sabe si asistieron o no, cuántas asistieron',
        source: 'reporte',
        formula: 'Show up ÷ (Show up + No show)',
        note: 'Corregido el 02/sep/2026: antes dividía por TODAS las agendas del período (incluyendo Pendiente, Confirmado y No Lead, que todavía no tienen resultado o nunca lo van a tener), lo que diluía la tasa con llamadas que ni siquiera pasaron. Un closer lo detectó: el dashboard daba 27,9% cuando el show rate real, contando solo llamadas concluidas, era 57,1%.',
        benchmark: B.show
    },
    q_show_sobre_confirmada: {
        title: 'De las que confirmaron, cuántas realmente asistieron',
        source: 'derivado',
        formula: 'asistencias (reporte diario) ÷ confirmadas (agendas reales)',
        note: 'Mezcla dos fuentes: si te faltan reportes, las asistencias bajan sin que bajen las confirmadas y este número queda más bajo de lo real.',
        benchmark: B.show
    },
    q_pitch_rate: {
        title: 'De las llamadas que asistieron, en cuántas presentaste la oferta',
        source: 'reporte',
        formula: 'presentaciones ÷ asistencias',
        note: 'Un pitch rate bajo casi siempre es una de dos cosas: llamadas que se caen antes de la oferta, o el check de "presentó oferta" sin marcar al cerrar la llamada.',
        benchmark: B.pitch
    },
    q_close_llamada: {
        title: 'De las llamadas que asistieron, cuántas cerraron',
        source: 'derivado',
        formula: 'ventas (PIF + Split) ÷ asistencias',
        benchmark: B.close
    },
    q_close_presentacion: {
        title: 'De las ofertas presentadas, cuántas cerraron',
        source: 'derivado',
        formula: 'ventas (PIF + Split) ÷ presentaciones',
        benchmark: B.close
    },

    // ---------- Señas ----------
    senas_count: {
        title: 'Señas cobradas en el período',
        source: 'ventas',
        formula: 'pagos con tipo "seña"',
        note: 'Una seña reserva el lugar pero no cierra la venta: no entra en el close rate ni en el ticket promedio.'
    },
    senas_ticket: {
        title: 'Monto promedio de reserva',
        source: 'ventas',
        formula: 'cash de señas ÷ cantidad de señas'
    },
    senas_por_presentacion: {
        title: 'De cada oferta presentada, cuántas dejaron seña',
        source: 'derivado',
        formula: 'señas ÷ presentaciones'
    },
    senas_por_llamada: {
        title: 'De cada llamada que asistió, cuántas dejaron seña',
        source: 'derivado',
        formula: 'señas ÷ asistencias'
    },
    senas_a_pif: {
        title: 'Señas que terminaron pagando el programa completo',
        source: 'ventas',
        formula: 'señas con un pago PIF posterior del mismo cliente',
        note: 'El cruce es por instagram, mail o teléfono, y solo mira pagos con fecha posterior a la propia seña.'
    },
    senas_a_split: {
        title: 'Señas que terminaron abriendo un plan de cuotas',
        source: 'ventas',
        formula: 'señas con un pago Split posterior del mismo cliente'
    },
    senas_pendientes: {
        title: 'Señas que todavía no derivaron en ningún pago',
        source: 'derivado',
        formula: 'señas − (las que pasaron a PIF o a Split)',
        note: 'Una seña reciente aparece acá hasta que el cliente pague: no siempre es una seña perdida, pero sí es plata comprometida sin cerrar.'
    },
    senas_close_promesa: {
        title: 'Asistencias que terminaron en venta o al menos en reserva',
        source: 'derivado',
        formula: '(ventas + señas) ÷ asistencias',
        note: 'Mide compromiso de compra total, cerrado o no. Siempre queda por encima del close rate.'
    },

    // ---------- Dinero ----------
    cash_nuevas_ventas: {
        title: 'Cash de ventas nuevas',
        source: 'ventas',
        formula: 'cobrado en pagos PIF + Split'
    },
    cash_cobro_cuotas: {
        title: 'Cash de cuotas de ventas anteriores',
        source: 'ventas',
        formula: 'cobrado en pagos de tipo cuota',
        note: 'Es plata que entra este mes por ventas cerradas antes. No cuenta como venta nueva.'
    },
    cash_senas: {
        title: 'Cash de señas / reservas',
        source: 'ventas',
        formula: 'cobrado en pagos de tipo seña'
    },
    cash_upsell_renovacion: {
        title: 'Cash de clientes que ya habían comprado',
        source: 'ventas',
        formula: 'cobrado en upsells + renovaciones'
    },
    cash_otros: {
        title: 'Pagos con un tipo que el sistema no reconoce',
        source: 'ventas',
        formula: 'pagos cuyo "tipo de pago" no matchea ninguna categoría conocida',
        note: 'Suman al cash total pero no cuentan como venta. Si aparecen, hay etiquetas nuevas que normalizar en el registro de ventas.'
    },
    deuda_vencida: {
        title: 'Cuotas cuya fecha de vencimiento ya pasó y siguen impagas',
        source: 'cuotas',
        formula: 'cuotas pendientes con vencimiento anterior a hoy',
        note: 'Esto sí es un problema de cobranza, a diferencia del cronograma futuro.'
    },
    deuda_por_vencer: {
        title: 'Cuotas futuras del cronograma normal',
        source: 'cuotas',
        formula: 'cuotas pendientes con vencimiento de hoy en adelante',
        note: 'No es un problema: es el plan de pagos siguiendo su curso.'
    },
    programas: {
        title: 'Unidades vendidas y ticket promedio por programa',
        source: 'ventas',
        formula: 'ventas PIF + Split agrupadas por el programa del pago',
        note: 'El programa sale del prefijo del tipo de pago (RR / AL / SI); si no viene, se intenta deducir del examen del cliente.'
    },

    // ---------- Fuente y actividad ----------
    fuente_agendas: {
        title: 'Agendas por origen del lead',
        source: 'agendas',
        formula: 'citas del período agrupadas por su campo de origen',
        note: 'Aproximado: no hay forma de cruzar las ventas con el origen, así que esta tabla solo llega hasta el show rate.'
    },
    disciplina_reportes: {
        title: 'Closers con el reporte diario al día',
        source: 'reporte',
        formula: 'closers cuyo último reporte es de ayer u hoy ÷ closers activos',
        note: 'Es un número del equipo completo, no del closer filtrado arriba.'
    },
    referidos: {
        title: 'Referidos conseguidos y agendados',
        source: 'reporte',
        formula: 'contadores de referidos de los reportes del período',
        note: 'Hoy los dos contadores son el mismo número real: no existe una señal de "pedidos" separada de "concretados".'
    },

    // ---------- Ranking ----------
    rank_reportes: {
        title: 'Cobertura de reportes de ese closer en el período',
        source: 'reporte',
        formula: 'días con reporte enviado ÷ días del período',
        note: 'Todo lo que sale del reporte diario (agendas, asistencias, presentaciones) está incompleto en la misma proporción.'
    }
};

export const tip = (id) => METRICS[id] || {};

// Color de salud de una tasa según su benchmark. Devuelve un token de Tailwind ya resuelto para
// no repetir la misma cadena de ternarios en cada tarjeta.
export const rateHealth = (value, benchmark) => {
    if (!benchmark) return { text: 'text-base', bar: '#6366F1', label: null };
    if (value > 100) return { text: 'text-rose-400', bar: '#F43F5E', label: 'imposible' };
    if (value >= benchmark.good) return { text: 'text-emerald-400', bar: '#22C55E', label: 'bien' };
    if (value >= benchmark.warn) return { text: 'text-amber-400', bar: '#F59E0B', label: 'a mejorar' };
    return { text: 'text-rose-400', bar: '#F43F5E', label: 'crítico' };
};
