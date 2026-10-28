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
/** «163 de 2.448 leads»: la cuenta real detrás de un porcentaje o un costo (Kerwin, 28/10/2026). */
const nDeM = (a, b, unidad) => `${a} de ${b}${unidad ? ` ${unidad}` : ''}`;

export const formatos = (moneda) => ({
    n: (v) => formatear(v, 'num'),
    d: (v) => formatear(v, 'money', moneda),
    p: (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`),
    x: (v) => formatear(v, 'veces'),
});

/** Los grupos de «Métrica por métrica»; `s` y `w` son las fuentes tal cual llegan del tablero. */
export const gruposDe = (s, w, moneda = 'USD') => {
    const d = (v) => formatear(v, 'money', moneda);
    const reportadas = (f) => f.reportadas ?? f.agendas;
    return [
    { id: 'embudo', titulo: 'Embudo', filas: [
        { id: 'leads', label: 'Leads entrantes', tipo: 'vol', fmt: 'n', s: s.leads, w: w.leads,
            hint: 'Setting: palabras clave · Workshop: clics al grupo' },
        { id: 'agendas', label: 'Agendas', tipo: 'vol', fmt: 'n', s: s.agendas, w: w.agendas },
        { id: 'lead_agenda', label: 'Lead → agenda', hint: 'agendas ÷ leads', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.agendas, s.leads), w: razon(w.agendas, w.leads),
            ds: nDeM(num(s.agendas), num(s.leads), 'leads'), dw: nDeM(num(w.agendas), num(w.leads), 'leads') },
        { id: 'show_up', label: 'Show up', tipo: 'vol', fmt: 'n', s: s.show_up, w: w.show_up },
        { id: 'agenda_show', label: 'Agenda → show', hint: 'asistieron ÷ citas con resultado', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.show_up, reportadas(s)), w: razon(w.show_up, reportadas(w)),
            ds: nDeM(num(s.show_up), num(reportadas(s)), 'con resultado'), dw: nDeM(num(w.show_up), num(reportadas(w)), 'con resultado') },
        { id: 'ventas', label: 'Ventas', tipo: 'vol', fmt: 'n', s: s.ventas, w: w.ventas },
        { id: 'show_venta', label: 'Show → venta', hint: 'ventas ÷ asistieron', tipo: 'up', fmt: 'p', pp: true,
            s: razon(s.ventas, s.show_up), w: razon(w.ventas, w.show_up),
            ds: nDeM(num(s.ventas), num(s.show_up), 'que asistieron'), dw: nDeM(num(w.ventas), num(w.show_up), 'que asistieron') },
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
            s: razon(s.new_cash, s.ventas), w: razon(w.new_cash, w.ventas),
            ds: nDeM(d(s.new_cash), num(s.ventas), 'ventas'), dw: nDeM(d(w.new_cash), num(w.ventas), 'ventas') },
        { id: 'roas_new_cash', label: 'ROAS New Cash', hint: 'New Cash ÷ gastado', tipo: 'up', fmt: 'x', s: s.roas_new_cash, w: w.roas_new_cash,
            ds: nDeM(d(s.new_cash), d(s.gasto)), dw: nDeM(d(w.new_cash), d(w.gasto)) },
        { id: 'roas_total', label: 'ROAS Total', hint: 'Cash total ÷ gastado', tipo: 'up', fmt: 'x', s: s.roas_total, w: w.roas_total,
            ds: nDeM(d(s.cash_total), d(s.gasto)), dw: nDeM(d(w.cash_total), d(w.gasto)) },
    ] },
    { id: 'costos', titulo: 'Costos', filas: [
        { id: 'cpl', label: 'Costo por lead', tipo: 'down', fmt: 'd', s: s.cpl, w: w.cpl },
        { id: 'costo_agenda', label: 'Costo por agenda', tipo: 'down', fmt: 'd', s: s.costo_agenda, w: w.costo_agenda },
        { id: 'costo_show', label: 'Costo por show', tipo: 'down', fmt: 'd',
            s: razon(s.gasto, s.show_up), w: razon(w.gasto, w.show_up) },
        { id: 'costo_venta', label: 'Costo por venta', hint: 'CAC', tipo: 'down', fmt: 'd', s: s.costo_venta, w: w.costo_venta,
            ds: nDeM(d(s.gasto), num(s.ventas), 'ventas'), dw: nDeM(d(w.gasto), num(w.ventas), 'ventas') },
    ] },
    ];
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
const TARJETAS = ['lead_agenda', 'roas_total', 'costo_venta', 'show_venta'];
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
            id, label: fila.label, big, winner: gana === SETTING.key ? SETTING.label : gana ? WORKSHOP.label : 'Sin ganador',
            color: gana === SETTING.key ? SETTING.color : gana ? WORKSHOP.color : 'var(--text-muted)',
            s: f[fila.fmt](fila.s), w: f[fila.fmt](fila.w), sd: fila.ds || '', wd: fila.dw || '',
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
    { label: 'Agendas', paso: 'agendas ÷ leads', k: 'agendas', previo: 'leads', unidad: 'leads' },
    { label: 'Show up', paso: 'asistieron ÷ agendas', k: 'show_up', previo: 'agendas', unidad: 'agendas', conResultado: true },
    { label: 'Ventas', paso: 'ventas ÷ asistieron', k: 'ventas', previo: 'show_up', unidad: 'que asistieron' },
];

export const embudoNormalizado = (s, w) => {
    const por = (fuente, k) => (fuente.leads ? (fuente[k] / fuente.leads) * 1000 : 0);
    const mayor = Math.max(por(s, 'agendas'), por(w, 'agendas')) || 1;
    const texto = (v) => v.toFixed(v < 10 ? 1 : 0);
    const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
    const delPaso = (f, p) => (f[p.previo]
        ? `${pct(f[p.k], f[p.previo])} · ${nDeM(num(f[p.k]), num(f[p.previo]), p.unidad)}` : 'sin paso anterior');
    const conResultado = (f, p) => {
        if (!p.conResultado) return '';
        const base = f.reportadas ?? f.agendas;
        return `${pct(f[p.k], base)} de las citas con resultado · ${nDeM(num(f[p.k]), num(base))}`;
    };
    return PASOS.map((p) => ({
        label: p.label, paso: p.paso,
        s: texto(por(s, p.k)), w: texto(por(w, p.k)),
        sw: `${(por(s, p.k) / mayor) * 100}%`, ww: `${(por(w, p.k) / mayor) * 100}%`,
        sr: delPaso(s, p), wr: delPaso(w, p),
        sr2: conResultado(s, p), wr2: conResultado(w, p),
    }));
};
