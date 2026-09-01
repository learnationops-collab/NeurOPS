// Matemática del embudo de Workshop — compartida entre el panel de Diagnóstico,
// el Simulador y el Plan de Acciones, para no triplicar la misma lógica.
//
// Las 8 etapas y su orden son las mismas que ya usa `WorkshopFunnelView.jsx` y el
// modelo `WorkshopEvent` (backend): Leads → WhatsApp → Asistencia → Retención
// clase → Retención pitch → Formulario → Agendamiento → Show up cita → Cierre.
// Cada etapa se define por qué dos campos crudos de un evento la componen
// (numerador / denominador de la tasa "de cada 100 que llegaron al paso
// anterior, cuántos llegaron a este").

export const STAGE_ORDER = [
    { key: 'whatsapp', label: 'Conversión a WhatsApp', num: 'whatsapp_leads', den: 'leads', goalKey: 'meta_whatsapp' },
    { key: 'asistencia', label: 'Asistencia al workshop', num: 'show_up', den: 'whatsapp_leads', goalKey: 'meta_asistencia' },
    { key: 'retencion_clase', label: 'Retención de la clase', num: 'pitch_leads', den: 'show_up', goalKey: 'meta_retencion_clase' },
    { key: 'retencion_pitch', label: 'Retención del pitch', num: 'pitch_final_leads', den: 'pitch_leads', goalKey: 'meta_retencion_pitch' },
    { key: 'conversion_form', label: 'Conversión del form', num: 'aplicaciones_form', den: 'pitch_final_leads', goalKey: 'meta_conversion_form' },
    { key: 'agendamiento', label: 'Agendamiento', num: 'agendas_exitosas', den: 'aplicaciones_form', goalKey: 'meta_agendamiento' },
    { key: 'show_up_citas', label: 'Show up de citas', num: 'show_up_sales_call', den: 'agendas_exitosas', goalKey: 'meta_show_up_citas' },
    { key: 'close_rate', label: 'Close rate', num: 'sales', den: 'show_up_sales_call', goalKey: 'meta_close_rate' },
];

const RAW_FIELDS = [
    'inversion', 'leads', 'whatsapp_leads', 'show_up', 'pitch_leads', 'pitch_final_leads',
    'aplicaciones_form', 'agendas_exitosas', 'show_up_sales_call', 'sales', 'cash_collected'
];

// Suma los campos crudos de una lista de eventos — mismo patrón que `totalStats`
// en WorkshopDashboardPage.jsx, extendido a los pasos intermedios del embudo.
export function aggregateTotals(events) {
    const totals = Object.fromEntries(RAW_FIELDS.map((f) => [f, 0]));
    (events || []).forEach((e) => {
        RAW_FIELDS.forEach((f) => { totals[f] += e[f] || 0; });
    });
    return totals;
}

// Tasa real (0-1) de cada una de las 8 etapas, a partir de un objeto de totales.
export function stageRates(totals) {
    const rates = {};
    STAGE_ORDER.forEach((s) => {
        const den = totals[s.den] || 0;
        rates[s.key] = den > 0 ? (totals[s.num] || 0) / den : 0;
    });
    return rates;
}

// Encadena las 8 tasas sobre una base de leads → ventas proyectadas. Mismo
// modelo lineal que la referencia externa ("los puntos porcentuales se suman
// por palanca con techo de 95%; sirve para priorizar, no es una predicción").
export function projectSales(leadsBase, rates) {
    let n = Math.max(0, leadsBase || 0);
    STAGE_ORDER.forEach((s) => {
        const r = Math.min(0.95, Math.max(0, rates[s.key] || 0));
        n = n * r;
    });
    return n;
}

// Gap de cada etapa contra su meta (en puntos porcentuales), ordenado de mayor
// a menor fuga. `impactoVentas`: cuántas ventas más se proyectan si SOLO esa
// etapa llega a su meta (las demás quedan en su tasa real actual).
export function computeFuga(totals, rates, goals) {
    if (!goals) return [];
    const leadsBase = totals.leads || 0;
    const ventasActuales = projectSales(leadsBase, rates);

    return STAGE_ORDER.map((s) => {
        const real = (rates[s.key] || 0) * 100;
        const meta = goals[s.goalKey] ?? 0;
        const gap = meta - real;

        const ratesConMejora = { ...rates, [s.key]: meta / 100 };
        const ventasConMejora = projectSales(leadsBase, ratesConMejora);

        let estado = 'ok';
        if (gap > (goals.banda_limite ?? 5)) estado = 'fuga';
        else if (gap > 0) estado = 'al_limite';

        return {
            key: s.key,
            label: s.label,
            real: Math.round(real * 10) / 10,
            meta,
            gap: Math.round(gap * 10) / 10,
            estado,
            impactoVentas: Math.max(0, ventasConMejora - ventasActuales),
        };
    }).sort((a, b) => b.gap - a.gap);
}

// Heurística de "qué tan cubierto está el ciclo diagnóstico → plan → ejecución".
// Documentada como heurística propia (no busca replicar ningún número de
// referencia externa): sirve para priorizar, no es una predicción.
export function computeClarityScore(goals, actions, fugas) {
    const goalsConfigured = goals && STAGE_ORDER.every((s) => (goals[s.goalKey] ?? 0) > 0);
    const diagnostico = goalsConfigured ? 100 : 0;

    const etapasConFuga = (fugas || []).filter((f) => f.estado !== 'ok');
    let plan = 0;
    if (etapasConFuga.length > 0) {
        const cubiertas = etapasConFuga.filter((f) =>
            (actions || []).some((a) => a.stage_key === f.key)
        ).length;
        plan = Math.round((cubiertas / etapasConFuga.length) * 100);
    }

    const total = (actions || []).length;
    const done = (actions || []).filter((a) => a.status === 'done').length;
    const ejecucion = total > 0 ? Math.round((done / total) * 100) : 0;

    const score = Math.round((diagnostico + plan + ejecucion) / 3);
    return { diagnostico, plan, ejecucion, score };
}

export const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
