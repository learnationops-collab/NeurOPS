/**
 * La lógica de la app de Finanzas (07/11/2026), sin React: de lo que manda el backend a lo que se dibuja.
 *
 * Es la del artifact «Payroll Octubre» con los datos de la plataforma en lugar de los escritos a mano:
 * las personas son la Nómina del mes (`/public/finance/payroll`), las comisiones las de Payroll
 * (`/public/financial-sales/payroll`), los cobros los de Finanzas › Cobros y los saldos la foto de Profit.
 */

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (lista, f = (x) => x) => r2(lista.reduce((t, x) => t + (Number(f(x)) || 0), 0));
export const money = (n, dec = 2) => {
    const v = Number(n) || 0;
    const txt = Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return `${v < 0 ? '−' : ''}$${txt}`;
};
export const pctTxt = (n) => `${String(n ?? 0).replace('.', ',')}%`;
export const pctDe = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const iniciales = (n) => (n || '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const AREAS = [['ventas', 'Ventas', 'var(--mag)'], ['fulfillment', 'Fulfillment', 'var(--neu)'],
    ['operaciones', 'Operaciones', 'var(--amb)'], ['otros', 'Otros', 'var(--vio)']];
export const MET = { mercury: ['Mercury', 'var(--neu)'], airtm: ['AirTM', 'var(--ok)'] };
export const EST = {
    pendiente: ['Pendiente', 'var(--amb)', 'Todavía no salió'],
    transito: ['En tránsito', 'var(--neu)', 'Salió, todavía no llegó'],
    pagado: ['Pagado', 'var(--ok)', 'Ya lo recibió'],
    revisar: ['A revisar', 'var(--mag)', 'Hay algo que ver'],
};
export const SALE = (e) => e === 'pagado' || e === 'transito';
export const PAL = ['var(--mag)', 'var(--neu)', 'var(--vio)', 'var(--amb)', 'var(--ok)', 'var(--meta)'];

const areaDe = (rol) => {
    const r = (rol || '').toLowerCase();
    if (/closer|setter|director|venta/.test(r)) return 'ventas';
    if (/ful+fil|confirm|soporte|coach/.test(r)) return 'fulfillment';
    if (/operac|admin/.test(r)) return 'operaciones';
    return 'otros';
};
const rolLimpio = (rol) => (rol || '').replace(/ful+fil+ment/i, 'Fulfillment');
// Los que figuran como Stripe se pagan por Mercury (así lo hacía el payroll de octubre).
export const metodoDe = (m) => ((m || '').toLowerCase().includes('airtm') ? 'airtm' : 'mercury');
const ms = (iso) => (iso ? Date.parse(iso) : 0);

/** Una persona de la nómina del mes, con lo que se le paga y lo que falta. */
export const persona = (it) => {
    const mov = Array.isArray(it.movements) ? it.movements : [];
    const base = r2(it.base_salary), com = r2(it.commissions), bonos = r2(it.bonuses);
    const recibio = r2(it.transferencias_recibidas);
    const tot = r2(base + com + bonos - recibio);
    const desc = sum(mov.filter((x) => x.t === 'desc'), (x) => x.m);
    const pag = sum(mov.filter((x) => x.t === 'pago'), (x) => x.m);
    const neto = r2(tot - desc);
    const estado = it.status || (it.is_paid ? 'pagado' : 'pendiente');
    const pagado = estado === 'pagado';
    const p = {
        k: it.member_id, id: it.id, n: (it.member_name || '').trim(), rol: rolLimpio(it.role),
        a: areaDe(it.role), clave: it.clave || null, base, com, bonos, recibio, tot, mov, desc, pag, neto, estado,
        metodo: metodoDe(it.payment_method), salio: ms(it.sent_at), comManual: !!it.commissions_manual,
        variable: !!it.clave, fijo: tot === 0 && !mov.length && !com,
    };
    p.trans = pagado ? Math.max(neto, pag) : pag;
    p.falta = pagado ? 0 : Math.max(0, r2(neto - pag));
    p.demas = Math.max(0, r2(pag - neto));
    return p;
};

/** La nómina de varios meses (un período personalizado) sumada por integrante, sin estados. */
export const sumarNomina = (nominas) => {
    const por = new Map();
    nominas.flat().forEach((it) => {
        const prev = por.get(it.member_id);
        if (!prev) { por.set(it.member_id, { ...it, movements: [], status: null, is_paid: false }); return; }
        ['base_salary', 'commissions', 'bonuses', 'transferencias_recibidas'].forEach((c) => {
            prev[c] = r2((prev[c] || 0) + (it[c] || 0));
        });
    });
    return [...por.values()];
};

export const heroDe = (personas) => {
    const act = personas.filter((p) => !p.fijo);
    const tot = sum(act, (p) => p.neto);
    const fe = (e) => sum(act.filter((p) => p.estado === e), (p) => p.falta);
    const seg = [['Transferido', sum(act, (p) => p.trans), 'var(--ok)'], ['En tránsito', fe('transito'), 'var(--neu)'],
        ['Falta transferir', sum(act.filter((p) => p.estado === 'pendiente' || p.estado === 'pagado'), (p) => p.falta), 'var(--amb)'],
        ['A revisar', fe('revisar'), 'var(--mag)']].filter((s, i) => i !== 1 || s[1] > 0);
    const metodos = Object.keys(MET).map((m) => {
        const ps = act.filter((p) => p.metodo === m && p.falta > 0);
        return [m, sum(ps, (p) => p.falta), ps.length];
    });
    return { tot, seg, metodos, faltan: act.filter((p) => p.falta > 0) };
};

/** El texto que se le manda a cada persona con su pago. */
export const resumenDe = (p, titulo) => {
    const L = [`${titulo} · ${p.n}`, `Te corresponde: ${money(p.tot)}`];
    const det = [];
    if (p.base) det.push(`base ${money(p.base)}`);
    if (p.com) det.push(`comisión ${money(p.com)}`);
    if (p.bonos) det.push(`bonos ${money(p.bonos)}`);
    if (p.recibio) det.push(`menos ${money(p.recibio)} que recibiste de un cliente`);
    if (det.length > 1) L[1] += ` (${det.join(' + ').replace('+ menos', '−')})`;
    p.mov.forEach((x) => L.push(`${x.t === 'desc' ? 'Descuento' : 'Ya te transferí'}${x.n ? ` (${x.n})` : ''}: −${money(x.m)}`));
    if (p.estado === 'pagado' && p.pag < p.neto) L.push(`Ya te transferí${p.pag ? ' el resto' : ''}: −${money(r2(p.neto - p.pag))}`);
    L.push(p.demas ? `Te transferí de más: ${money(p.demas)}`
        : p.estado === 'transito' ? `En camino: ${money(p.falta)}` : `Falta transferirte: ${money(p.falta)}`);
    return L.join('\n');
};

// AirTM lee el punto como separador de miles (754.95 → 75.495): ahí va con coma. Mercury, con punto.
export const montoParaBanco = (p) => (p.falta || p.neto).toFixed(2).replace('.', p.metodo === 'airtm' ? ',' : '.');

// ---------- Profit

export const CUENTAS = [['mercury', 'Mercury', 'var(--neu)', 1], ['payoneer', 'Payoneer', 'var(--vio)', 1],
    ['stripe', 'Stripe', 'var(--mag)', 2], ['hotmart', 'Hotmart', 'var(--amb)', 1]];

/** Lo que salió de las cuentas DESPUÉS de la foto de saldos: sigue en el saldo, así que resta. */
const salioDespues = (personas, desde) => {
    const L = [];
    personas.filter((p) => !p.fijo).forEach((p) => {
        let v = sum(p.mov.filter((x) => x.t === 'pago' && x.e > desde), (x) => x.m);
        if (SALE(p.estado) && p.salio > desde) v += Math.max(0, p.neto - p.pag);
        v = r2(v);
        if (v > 0) L.push([v, 'sp', `${p.n} ${money(v)} · pagado`]);
    });
    return L;
};

/**
 * El profit libre: lo que hay en las cuentas menos lo que todavía se va a pagar (payroll que falta y lo
 * que salió después de la foto), la reserva de anuncios y lo que entró del mes siguiente.
 */
export const profitDe = ({ personas, foto, presupuesto }) => {
    const cuentas = foto?.accounts || {};
    const liq = r2(sum(CUENTAS, ([k]) => sum(cuentas[k] || [])));
    const desde = foto?.taken_at ? Date.parse(foto.taken_at) : 0;
    const pend = personas.filter((p) => !p.fijo && p.falta > 0 && p.estado !== 'transito');
    const salio = foto ? salioDespues(personas, desde) : [];
    const gastado = r2(foto?.ads_spent ?? 0);
    const reserva = Math.max(0, r2((presupuesto || 0) - gastado));
    const sig = (foto?.next_income || []).map(Number).filter((v) => v > 0);
    const res = [
        ['Payroll', r2(sum(pend, (p) => p.falta) + sum(salio, (x) => x[0])), 'var(--amb)',
            [...salio, ...pend.map((p) => [p.falta, '', `${p.n} ${money(p.falta)}`])]],
        ['Anuncios', reserva, 'var(--neu)', [[gastado, 'sp', `Gastado ${money(gastado)}`],
            [reserva, '', `Reserva ${money(reserva)} de ${money(presupuesto || 0, 0)}`]]],
        ['Mes siguiente', sum(sig), 'var(--mag)', sig.map((v) => [v, '', `Ingreso ${money(v)} · no se toca`])],
    ];
    const pro = r2(liq - sum(res, (r) => r[1]));
    return { liq, res, pro, desde, mb: Math.max(presupuesto || 0, ...res.map((r) => sum(r[3], (x) => x[0]))) };
};

// ---------- Diferencias: sistema contra lo que llegó a las pasarelas

const nombreCorto = (n) => {
    const w = (n || '').trim().split(/\s+/);
    return w.length > 1 ? `${w[0]} ${w[1][0]}.` : w[0] || '—';
};

/**
 * El puente Sistema → En pasarelas → Llegó: de los cobros del período (Finanzas › Cobros). Solo los que
 * pasan por Stripe o Hotmart: una transferencia u otro medio no tiene CSV con qué compararse.
 */
export const puenteDe = (cobros) => {
    const filas = (cobros?.filas || []).filter((f) => !['transferencia', 'otro_medio'].includes(f.estado));
    const sis = sum(filas, (f) => f.neto);
    const faltan = filas.filter((f) => (f.estado === 'sin_csv' && !f.falta_csv) || f.estado === 'otra_pasarela');
    const sinCsv = filas.filter((f) => f.estado === 'sin_csv' && f.falta_csv);
    const fees = sum(filas.filter((f) => f.estado === 'neto_distinto'), (f) => f.diferencia);
    const g1 = [
        ...faltan.sort((a, b) => b.neto - a.neto).slice(0, 4).map((f) => [nombreCorto(f.cliente),
            f.estado === 'otra_pasarela' ? `En ${f.pasarela_csv}` : 'No llegó', f.neto, 'var(--bad)']),
        ...(faltan.length > 4 ? [[`${faltan.length - 4} más`, 'No llegaron', sum(faltan.slice(4), (f) => f.neto), 'var(--bad)']] : []),
        ...(sinCsv.length ? [['Sin CSV', `Falta subir ${[...new Set(sinCsv.map((f) => f.falta_csv))].join(' y ')}`, sum(sinCsv, (f) => f.neto), 'var(--amb)']] : []),
        ...(Math.abs(fees) > 0.004 ? [['Fees', fees < 0 ? 'a favor' : 'de más', fees, fees < 0 ? 'var(--ok)' : 'var(--amb)']] : []),
    ];
    const csv = r2(sis - sum(g1, (x) => x[2]));
    const extra = (cobros?.sin_reportar || []).filter((s) => !s.revisada);
    const g2 = extra.length ? [['Sin reportar', `${extra.length} ${extra.length === 1 ? 'cobro' : 'cobros'} en el CSV`, -sum(extra, (s) => s.neto), 'var(--ok)']] : [];
    const llega = r2(csv - sum(g2, (x) => x[2]));
    return { nodos: [['Sistema', sis], ['En pasarelas', csv], ['Llegó', llega]], gaps: [g1, g2].filter((g) => g.length), vacio: !filas.length };
};

// ---------- Dashboard

const TIPO_CORTO = (t) => (t || 'Sin tipo');
export const cashDe = (f) => {
    if (f.estado === 'transferencia' || f.estado === 'otro_medio') return r2(f.neto);
    if (f.estado === 'sin_csv' && !f.falta_csv) return 0;
    return r2(f.neto_csv ?? f.neto);
};

export const agrupar = (filas, clave) => {
    const m = new Map();
    filas.forEach((f) => {
        const c = cashDe(f);
        if (!c) return;
        const k = typeof clave === 'function' ? clave(f) : f[clave];
        const o = m.get(k) || { v: 0, n: 0 };
        o.v += c; o.n += 1;
        m.set(k, o);
    });
    return [...m.entries()].map(([k, o]) => [k || '—', r2(o.v), o.n]).sort((a, b) => b[1] - a[1]);
};

const ORIGENES = { workshop: 'Workshop', setting: 'Setting', vsl: 'VSL', fulfillment: 'Fulfillment', sin_procedencia: 'Sin procedencia' };
export const origenDe = (f) => (f.origen === 'setting' && f.origen_detalle ? `Agenda ${f.origen_detalle}` : ORIGENES[f.origen] || 'Sin procedencia');
export const procesadorDe = (f) => (f.estado === 'transferencia' ? 'Transferencia' : f.pasarela_csv || f.procesador || 'Otro');
export const tipoDe = (f) => TIPO_CORTO(f.tipo_pago);

/** Lo que muestra el Dashboard: totales, reparto y nómina por área, del período. */
export const dashboardDe = ({ cobros, personas, puente }) => {
    const filas = cobros?.filas || [];
    const cobrado = sum(filas, cashDe);
    const n = filas.filter((f) => cashDe(f) > 0).length;
    const fees = sum(filas.filter((f) => !['transferencia', 'otro_medio'].includes(f.estado)), (f) => Math.max(0, (f.bruto || 0) - cashDe(f)));
    const act = personas.filter((p) => !p.fijo);
    const out = sum(act, (p) => p.neto);
    const areas = AREAS.map(([a, t, c]) => {
        const ps = act.filter((p) => p.a === a);
        return [t, sum(ps, (p) => p.neto), c, ps.length];
    }).filter((x) => x[3] > 0);
    const cats = [['Bases', sum(act, (p) => p.base), 'var(--neu)'],
        ['Comisiones ventas', sum(act.filter((p) => p.a === 'ventas'), (p) => p.com), 'var(--mag)'],
        ['Comisiones fulfillment', sum(act.filter((p) => p.a !== 'ventas'), (p) => p.com), 'var(--vio)'],
        ['Bonos', sum(act, (p) => p.bonos), 'var(--amb)']].filter((c) => c[1] > 0);
    const sis = puente?.nodos?.[0]?.[1] || 0;
    const dif = puente ? r2(puente.nodos[0][1] - puente.nodos[2][1]) : 0;
    return { filas, cobrado, n, fees, out, areas, cats, sis, dif, bruto: r2(cobrado + fees) };
};

/** El cash por día del período (fechas inclusive). */
export const porDia = (filas, desde, hasta) => {
    const d0 = new Date(`${desde}T00:00:00`), d1 = new Date(`${hasta}T00:00:00`);
    const dias = Math.min(93, Math.round((d1 - d0) / 864e5) + 1);
    const out = Array.from({ length: Math.max(1, dias) }, (_, i) => {
        const f = new Date(d0.getTime() + i * 864e5);
        return { iso: f.toISOString().slice(0, 10), v: 0, n: 0 };
    });
    const idx = new Map(out.map((x, i) => [x.iso, i]));
    filas.forEach((f) => {
        const c = cashDe(f), i = idx.get((f.fecha || '').slice(0, 10));
        if (c && i != null) { out[i].v += c; out[i].n += 1; }
    });
    return out;
};
