import { formatear } from '../anuncios/metricas';

/**
 * La comparación Setting vs Workshop de «Todos» (diseño de Kerwin, 24/10/2026): las mismas cuentas del
 * backend (`fuentes_service.py`), puestas lado a lado.
 *
 * Cada fila tiene un `tipo`: `vol` es un volumen (depende de cuánto se invirtió, no se corona), `up` una
 * tasa donde más es mejor y `down` un costo donde menos es mejor. `pp` marca las tasas que se comparan en
 * puntos porcentuales. Una cifra sin dato (null, o un costo en 0 porque no hubo con qué dividir) deja la
 * fila sin ganador.
 */
export const SETTING = { key: 'setting', label: 'Setting', color: 'var(--brand-secondary)' };
export const WORKSHOP = { key: 'workshop', label: 'Workshop', color: 'var(--info)' };

const razon = (a, b) => (b ? a / b : null);
const porCien = (v) => (v === null || v === undefined ? null : v / 100);
const num = (v) => formatear(v, 'num');
/** El título de cada lista que se puede abrir (`fuentes_registros_service.METRICAS`). */
export const TITULO_DE = {
    agendas: 'Agendas', agendas_alta: 'Agendas por fecha de alta', reportadas: 'Citas con resultado', show_up: 'Show up', ventas: 'Ventas', new_cash: 'New Cash',
    cash_total: 'Cash total', leads: 'Leads entrantes', gasto: 'Importe gastado',
};

/**
 * La cuenta detrás de un porcentaje, un costo o un ROAS (Kerwin, 28/10/2026): `{ a, b }` con el numerador y el
 * denominador, cada uno `{ t: texto, m: lista que lo suma }`. Se muestra en un tooltip y cada parte abre su lista.
 */
const parte = (t, m, unidad) => ({ t: unidad ? `${t} ${unidad}` : String(t), m });
export const cuentaDe = (id, f, d) => {
    const reportadas = f.reportadas ?? f.agendas;
    switch (id) {
        case 'lead_agenda': return { a: parte(num(f.agendas), 'agendas'), b: parte(num(f.leads), 'leads', 'leads') };
        case 'agenda_show': return { a: parte(num(f.show_up), 'show_up'), b: parte(num(reportadas), 'reportadas', 'con resultado') };
        case 'show_venta': return { a: parte(num(f.ventas), 'ventas'), b: parte(num(f.show_up), 'show_up', 'que asistieron') };
        case 'ticket': return { a: parte(d(f.new_cash), 'new_cash'), b: parte(num(f.ventas), 'ventas', 'ventas') };
        case 'roas_new_cash': return { a: parte(d(f.new_cash), 'new_cash'), b: parte(d(f.gasto), 'gasto', 'gastados') };
        case 'roas_total': return { a: parte(d(f.cash_total), 'cash_total'), b: parte(d(f.gasto), 'gasto', 'gastados') };
        case 'costo_venta': return { a: parte(d(f.gasto), 'gasto', 'gastados'), b: parte(num(f.ventas), 'ventas', 'ventas') };
        case 'cpl': return { a: parte(d(f.gasto), 'gasto', 'gastados'), b: parte(num(f.leads), 'leads', 'leads') };
        // Siempre las agendas por fecha de alta, aunque se cuente por reunión: lo que Meta gastó genera agendas al
        // darse de alta (28/10/2026). El backend manda esas en `agendas_alta`.
        case 'costo_agenda': return { a: parte(d(f.gasto), 'gasto', 'gastados'), b: parte(num(f.agendas_alta ?? f.agendas), 'agendas_alta', 'agendas por fecha de alta') };
        case 'costo_show': return { a: parte(d(f.gasto), 'gasto', 'gastados'), b: parte(num(f.show_up), 'show_up', 'que asistieron') };
        default: return null;
    }
};

export const formatos = (moneda) => ({
    n: (v) => formatear(v, 'num'),
    d: (v) => formatear(v, 'money', moneda),
    p: (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`),
    x: (v) => formatear(v, 'veces'),
});

/** Los grupos de «Métrica por métrica»; `s` y `w` son las fuentes tal cual llegan del tablero. */
/** Qué lista abre cada fila (`fuentes_registros_service.METRICAS`); las que no están no tienen lista todavía. */
const METRICA_DE = {
    lead_agenda: 'agendas', agendas: 'agendas', agenda_show: 'reportadas', show_up: 'show_up', ventas: 'ventas',
    show_venta: 'ventas', cuotas: 'cash_total', upsells: 'cash_total', new_cash: 'new_cash', cash_total: 'cash_total',
    ticket: 'ventas', roas_new_cash: 'new_cash', roas_total: 'cash_total', costo_show: 'show_up', costo_venta: 'ventas',
    leads: 'leads', gasto: 'gasto', cpl: 'leads', costo_agenda: 'agendas_alta',
};

export const gruposDe = (s, w, moneda = 'USD') => {
    const d = (v) => formatear(v, 'money', moneda);
    const reportadas = (f) => f.reportadas ?? f.agendas;
    const grupos = [
    { id: 'embudo', titulo: 'Embudo', filas: [
        { id: 'leads', label: 'Leads entrantes', tipo: 'vol', fmt: 'n', s: s.leads, w: w.leads,
            hint: 'Setting: palabras clave · Workshop: clics al grupo' },
        { id: 'agendas', label: 'Agendas', tipo: 'vol', fmt: 'n', s: s.agendas, w: w.agendas },
        { id: 'lead_agenda', label: 'Lead → agenda', hint: 'agendas ÷ leads', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.agendas, s.leads), w: razon(w.agendas, w.leads) },
        { id: 'show_up', label: 'Show up', tipo: 'vol', fmt: 'n', s: s.show_up, w: w.show_up },
        { id: 'agenda_show', label: 'Agenda → show', hint: 'asistieron ÷ citas con resultado', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.show_up, reportadas(s)), w: razon(w.show_up, reportadas(w)) },
        { id: 'ventas', label: 'Ventas', tipo: 'vol', fmt: 'n', s: s.ventas, w: w.ventas },
        { id: 'show_venta', label: 'Show → venta', hint: 'ventas ÷ asistieron', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.ventas, s.show_up), w: razon(w.ventas, w.show_up) },
        { id: 'cuotas', label: 'Cuotas cobradas', hint: `${s.cuotas} · ${w.cuotas} cuotas`, tipo: 'vol', fmt: 'd',
            s: s.cuotas_monto, w: w.cuotas_monto },
        { id: 'upsells', label: 'Upsells', hint: `${s.upsells} · ${w.upsells} upsells`, tipo: 'vol', fmt: 'd',
            s: s.upsells_monto, w: w.upsells_monto },
        { id: 'pct_upsell', label: 'Clientes con upsell', tipo: 'up', fmt: 'p', pp: true,
            s: porCien(s.pct_upsell), w: porCien(w.pct_upsell) },
    ] },
    { id: 'plata', titulo: 'Plata', filas: [
        { id: 'gasto', label: 'Importe gastado', tipo: 'vol', fmt: 'd', s: s.gasto, w: w.gasto },
        { id: 'new_cash', label: 'New Cash', tipo: 'vol', fmt: 'd', s: s.new_cash, w: w.new_cash },
        { id: 'cash_total', label: 'Cash total', tipo: 'vol', fmt: 'd', s: s.cash_total, w: w.cash_total },
        { id: 'ticket', label: 'Ticket por venta', hint: 'New Cash ÷ ventas', tipo: 'up', fmt: 'd',
            s: razon(s.new_cash, s.ventas), w: razon(w.new_cash, w.ventas) },
        { id: 'roas_new_cash', label: 'ROAS New Cash', hint: 'New Cash ÷ gastado', tipo: 'up', fmt: 'x', s: s.roas_new_cash, w: w.roas_new_cash },
        { id: 'roas_total', label: 'ROAS Total', hint: 'Cash total ÷ gastado', tipo: 'up', fmt: 'x', s: s.roas_total, w: w.roas_total },
    ] },
    { id: 'costos', titulo: 'Costos', filas: [
        { id: 'cpl', label: 'Costo por lead', tipo: 'down', fmt: 'd', s: s.cpl, w: w.cpl },
        { id: 'costo_agenda', label: 'Costo por agenda', hint: 'gastado ÷ agendas por fecha de alta', tipo: 'down', fmt: 'd', s: s.costo_agenda, w: w.costo_agenda },
        { id: 'costo_show', label: 'Costo por show', tipo: 'down', fmt: 'd',
            s: razon(s.gasto, s.show_up), w: razon(w.gasto, w.show_up) },
        { id: 'costo_venta', label: 'Costo por venta', hint: 'CAC', tipo: 'down', fmt: 'd', s: s.costo_venta, w: w.costo_venta },
    ] },
    ];
    return grupos.map((g) => ({
        ...g, filas: g.filas.map((f) => ({ ...f, metrica: METRICA_DE[f.id], ds: cuentaDe(f.id, s, d), dw: cuentaDe(f.id, w, d) })),
    }));
};

/** Un costo en 0 es «sin dato» (no hubo ventas, agendas… con qué dividir): no puede ganar. */
const valido = (fila, v) => v !== null && v !== undefined && !(fila.tipo === 'down' && v <= 0);

/** La key de la fuente que gana la fila, o null (volumen, falta un dato o empatan). */
export const ganadorDe = (fila) => {
    if (fila.tipo === 'vol' || !valido(fila, fila.s) || !valido(fila, fila.w) || fila.s === fila.w) return null;
    const settingGana = fila.tipo === 'up' ? fila.s > fila.w : fila.s < fila.w;
    return settingGana ? SETTING.key : WORKSHOP.key;
};

/** De cuánto gana: puntos si es una tasa, «% más barato» si es un costo, «×N» si es otra cifra. */
export const diferenciaDe = (fila) => {
    if (!ganadorDe(fila)) return '';
    const alto = Math.max(fila.s, fila.w);
    const bajo = Math.min(fila.s, fila.w);
    if (fila.pp) return `+${((alto - bajo) * 100).toFixed(1)} pp`;
    if (fila.tipo === 'down') return `${Math.round((1 - bajo / alto) * 100)}% más barato`;
    return bajo ? `×${(alto / bajo).toFixed(1)}` : '—';
};

/** Las dos barras de una fila, cada una relativa a la mayor de las dos. */
export const anchosDe = (fila) => {
    const mayor = Math.max(fila.s || 0, fila.w || 0);
    const ancho = (v) => (mayor > 0 && v > 0 ? `${(v / mayor) * 100}%` : '0%');
    return { s: ancho(fila.s), w: ancho(fila.w) };
};

/** Las cuatro tarjetas del resumen: la cifra que más separa a las dos fuentes y quién gana. */
const TARJETAS = ['lead_agenda', 'roas_new_cash', 'roas_total', 'costo_venta', 'show_venta'];
const EN_PUNTOS = new Set(['show_venta']);

export const tarjetasDe = (grupos, moneda) => {
    const f = formatos(moneda);
    const filas = grupos.flatMap((g) => g.filas);
    return TARJETAS.map((id) => {
        const fila = filas.find((x) => x.id === id);
        const gana = ganadorDe(fila);
        const alto = Math.max(fila.s, fila.w);
        const bajo = Math.min(fila.s, fila.w);
        // Un costo: cuánto más barato. Una tasa que se mide en puntos (show → venta): la diferencia en pp.
        // El resto: cuántas veces más (lead → agenda, ROAS).
        let big = '—';
        if (gana && fila.tipo === 'down') big = `−${Math.round((1 - bajo / alto) * 100)}%`;
        else if (gana && EN_PUNTOS.has(id)) big = diferenciaDe(fila);
        else if (gana && bajo) big = `×${(alto / bajo).toFixed(1)}`;
        return {
            id, label: fila.label, big, metrica: fila.metrica, winner: gana === SETTING.key ? SETTING.label : gana ? WORKSHOP.label : 'Sin ganador',
            color: gana === SETTING.key ? SETTING.color : gana ? WORKSHOP.color : 'var(--text-muted)',
            s: f[fila.fmt](fila.s), w: f[fila.fmt](fila.w), sd: fila.ds, wd: fila.dw,
        };
    });
};

/**
 * «De cada 1.000 leads, cuántos llegan a cada paso»: lo que permite comparar embudos de distinto tamaño.
 * La barra es la cifra llevada a 1.000 leads; a su derecha va la cuenta real y contra qué paso se divide
 * (antes decía «del paso anterior» sin decir cuál). El show up además se dice sobre las citas con resultado,
 * que es la misma base que en «Métrica por métrica».
 */
const PASOS = [
    { label: 'Agendas', paso: 'agendas ÷ leads', k: 'agendas', previo: 'leads', unidad: 'leads', metrica: 'agendas',
        metricaK: 'agendas', metricaPrevio: 'leads' },
    { label: 'Show up', paso: 'asistieron ÷ agendas', k: 'show_up', previo: 'agendas', unidad: 'agendas', conResultado: true,
        metrica: 'show_up', metricaK: 'show_up', metricaPrevio: 'agendas' },
    { label: 'Ventas', paso: 'ventas ÷ asistieron', k: 'ventas', previo: 'show_up', unidad: 'que asistieron', metrica: 'ventas',
        metricaK: 'ventas', metricaPrevio: 'show_up' },
];

export const embudoNormalizado = (s, w) => {
    const por = (fuente, k) => (fuente.leads ? (fuente[k] / fuente.leads) * 1000 : 0);
    const mayor = Math.max(por(s, 'agendas'), por(w, 'agendas')) || 1;
    // Con decimal, pero dicho: «5,3 por 1.000 leads» es una tasa, no 5,3 ventas (Kerwin, 28/10/2026).
    const texto = (v) => v.toFixed(v < 10 ? 1 : 0);
    const exacto = (v) => `${v.toFixed(1)} de cada 1.000 leads`;
    const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
    const delPaso = (f, p) => (f[p.previo]
        ? { pct: pct(f[p.k], f[p.previo]), cuenta: { a: parte(num(f[p.k]), p.metricaK), b: parte(num(f[p.previo]), p.metricaPrevio, p.unidad) } }
        : { pct: '—', cuenta: null });
    const conResultado = (f, p) => {
        if (!p.conResultado) return null;
        const base = f.reportadas ?? f.agendas;
        return { pct: pct(f[p.k], base), rotulo: 'con resultado',
            cuenta: { a: parte(num(f[p.k]), 'show_up'), b: parte(num(base), 'reportadas', 'con resultado') } };
    };
    return PASOS.map((p) => ({
        label: p.label, paso: p.paso, metrica: p.metrica,
        s: texto(por(s, p.k)), w: texto(por(w, p.k)), st: exacto(por(s, p.k)), wt: exacto(por(w, p.k)),
        sw: `${(por(s, p.k) / mayor) * 100}%`, ww: `${(por(w, p.k) / mayor) * 100}%`,
        sr: delPaso(s, p), wr: delPaso(w, p),
        sr2: conResultado(s, p), wr2: conResultado(w, p),
    }));
};
