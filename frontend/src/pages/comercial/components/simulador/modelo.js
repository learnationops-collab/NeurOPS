/**
 * Modelo del Simulador (24/10/2026): matemática pura, sin React ni red.
 *
 * Toda la plata y los porcentajes salen de las sumas que arma el backend (`comercial_simulador.py`)
 * con las definiciones del tablero: close rate = pago completo + split pay sobre los que asistieron
 * (nunca señas), ticket = solo ventas nuevas, comisión = % del cash NETO. Acá no hay ninguna
 * fórmula de negocio nueva: solo se proyecta con ellas.
 *
 * ## Cómo se proyecta
 *
 * Cada ventana (el mes en curso o los últimos 14/30/60 días) se vuelve un PERFIL: ritmo por DÍA
 * HÁBIL (lunes a viernes; lo que se cobra o agenda en un fin de semana queda dentro del ritmo del
 * día hábil) y las razones entre pasos del embudo. Un mes proyectado vale
 * `ritmo × días hábiles`; el mes en curso suma además lo que YA ocurrió (hasta ayer) y proyecta solo
 * los días que faltan, de hoy en adelante.
 *
 * ## Cómo se simula
 *
 * Con las palancas sin tocar, el escenario ES la base (mismos números). Cada palanca tocada cambia
 * su paso y el resto fluye por las razones de la base:
 *
 *   anuncios → entrantes → aperturas → agendas generadas (setters) → agendas de los closers →
 *   realizadas → asistieron (show up) → ventas (close rate) → cash (ticket) → comisiones
 *
 * Una palanca en PORCENTAJE multiplica el valor que ese paso ya tendría con lo de arriba; en VALOR
 * ABSOLUTO lo reemplaza. El equipo pone techo: las agendas generadas no pasan de lo que pueden
 * trabajar los setters y las de los closers no pasan de lo que pueden atender (cantidad × agendas
 * por persona), con una holgura de capacidad libre que se elige. Más gente solo suma si hay agendas
 * para repartir; por eso el simulador marca el cuello de botella en vez de callarlo.
 *
 * Lo que no se mueve: las cuotas, señas y otros cobros que no son ventas nuevas siguen al ritmo de
 * la base (vienen de ventas anteriores).
 */

const DIA_MS = 86400000;

const dos = (n) => String(n).padStart(2, '0');
const aIso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const deIso = (s) => new Date(`${s}T12:00:00`);
const div = (a, b) => (b > 0 ? a / b : 0);

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Días de lunes a viernes entre dos fechas, ambas incluidas (misma regla que el backend). */
export const habiles = (desde, hasta) => {
    let n = 0;
    for (let t = desde.getTime(); t <= hasta.getTime(); t += DIA_MS) {
        const dia = new Date(t).getDay();
        if (dia !== 0 && dia !== 6) n += 1;
    }
    return n;
};

/**
 * Los meses del horizonte, empezando por el actual. `pasados`: días hábiles ya cerrados (hasta
 * ayer, igual que las ventanas del backend); `restantes`: los que faltan proyectar, hoy incluido.
 */
export const mesesDelHorizonte = (hoyIso, cuantos) => {
    const hoy = deIso(hoyIso);
    const ayer = new Date(hoy.getTime() - DIA_MS);
    return Array.from({ length: cuantos }, (_, i) => {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1, 12);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 0, 12);
        const total = habiles(primero, ultimo);
        const pasados = i === 0 && primero <= ayer ? habiles(primero, ayer) : 0;
        return {
            clave: aIso(primero).slice(0, 7),
            etiqueta: MESES[primero.getMonth()],
            actual: i === 0,
            habiles: total,
            pasados,
            restantes: total - pasados,
        };
    });
};

/** Las magnitudes que se suman en una ventana, en crudo (sin dividir por días). */
const CAMPOS = ['entrantes', 'aperturas', 'generadas', 'agendas', 'realizadas', 'asistieron', 'ventas',
    'cashNuevas', 'cash', 'neto', 'gasto', 'entAds'];

export const crudosDe = (v) => ({
    entrantes: v.setters.entrantes, aperturas: v.setters.aperturas, generadas: v.setters.generadas,
    agendas: v.closers.agendas, realizadas: v.closers.realizadas, asistieron: v.closers.asistieron,
    ventas: v.closers.ventas, cashNuevas: v.closers.cash_nuevas, cash: v.closers.cash,
    neto: v.closers.cash_neto, gasto: v.ads.gasto, entAds: v.ads.entrantes,
    // Ticket × ventas: para promediar el ticket del tablero de varios tramos sin inventar otro.
    ticketPond: (v.closers.ticket ?? 0) * v.closers.ventas,
});

const vacios = () => Object.fromEntries(CAMPOS.map(c => [c, 0]));

/**
 * El perfil de una ventana: ritmo por día hábil + razones. Devuelve null si la ventana no tiene días
 * hábiles contra los que dividir (el día 1 del mes, o un lunes con la ventana del fin de semana).
 */
export const perfilDe = (ventana, base) => {
    if (!ventana || ventana.habiles < 1) return null;
    const c = crudosDe(ventana);
    const h = ventana.habiles;
    const ritmo = Object.fromEntries(CAMPOS.map(k => [k, c[k] / h]));
    const closers = ventana.equipo.closers || base.miembros.closers || 0;
    const setters = ventana.equipo.setters || base.miembros.setters || 0;
    const cash60 = base.ventanas['60']?.closers.cash || 0;
    return {
        ritmo,
        crudos: c,
        habiles: h,
        // Razones entre pasos (fracciones, no porcentajes).
        fApertura: div(c.aperturas, c.entrantes),
        fGeneradas: div(c.generadas, c.aperturas),
        fRealizadas: div(c.realizadas, c.agendas),
        showUp: div(c.asistieron, c.realizadas),
        closeRate: div(c.ventas, c.asistieron),
        ticket: ventana.closers.ticket ?? div(c.cashNuevas, c.ventas),
        netoSobreCash: div(c.neto, c.cash),
        // Qué parte de las agendas de los closers sale de un setter, y qué parte de las ventas.
        origenSetters: Math.min(1, div(c.generadas, c.agendas)),
        ventasSetters: Math.min(1, div(ventana.setters.ventas_originadas, c.ventas)),
        cpl: div(c.gasto, c.entAds),
        entrantesOtros: Math.max(0, ritmo.entrantes - ritmo.entAds),
        // Lo cobrado que Marketing atribuye a anuncios, sobre todo el cash de los últimos 60 días.
        cobradoAnuncios: cash60 > 0 ? Math.min(1, (base.anuncios.cobrado || 0) / cash60) : 0,
        closers,
        setters,
        agendasPorCloser: div(ritmo.agendas, closers),
        generadasPorSetter: div(ritmo.generadas, setters),
        comisiones: base.comisiones,
    };
};

/** Qué ventana usa cada línea base. El ritmo del mes cae a los últimos 14 días si lleva < 3 hábiles. */
export const ventanaDeBase = (linea, base) => {
    if (linea === 'mes') {
        const mes = base.ventanas.mes;
        if (mes && mes.habiles >= 3) return { ventana: mes, respaldo: false, clave: 'mes' };
        return { ventana: base.ventanas['14'], respaldo: true, clave: '14' };
    }
    return { ventana: base.ventanas[linea], respaldo: false, clave: linea };
};

/** ¿Tiene valor la palanca? `null`/vacío = mantenida. */
const tocada = (p) => !!p && p.valor !== null && p.valor !== '' && Number.isFinite(Number(p.valor));

/** pct: multiplica el valor que el paso ya tendría; abs: lo reemplaza. Nunca negativo. */
const aplicar = (p, fluido, escala = 1) => {
    if (!tocada(p)) return fluido;
    const v = Number(p.valor);
    return Math.max(0, p.modo === 'abs' ? v / escala : fluido * (1 + v / 100));
};

/**
 * Un día hábil del escenario: de las palancas al resultado. `palancas` = `{clave: {modo, valor}}`;
 * `holgura` = capacidad libre del equipo hoy (0.2 = pueden atender un 20% más que lo actual).
 */
export const diaHabil = (perfil, palancas = {}, holgura = 0.2) => {
    const r = perfil.ritmo;
    const p = palancas;

    const gasto = aplicar(p.gasto, r.gasto);
    const cpl = aplicar(p.cpl, perfil.cpl);
    const entAds = cpl > 0 ? gasto / cpl : r.entAds * (r.gasto > 0 ? gasto / r.gasto : 1);

    const entrantes = aplicar(p.entrantes, perfil.entrantesOtros + entAds);
    const aperturas = aplicar(p.aperturas, entrantes * perfil.fApertura);

    const nSetters = aplicar(p.setters, perfil.setters);
    const capSetters = perfil.setters > 0 ? nSetters * aplicar(p.prod_setters, perfil.generadasPorSetter) * (1 + holgura) : Infinity;
    const generadasPedidas = aplicar(p.generadas, aperturas * perfil.fGeneradas);
    const generadas = Math.min(generadasPedidas, capSetters);

    // Las agendas de los closers siguen a las generadas solo en la parte que sale de un setter.
    const seguir = r.generadas > 0 ? 1 - perfil.origenSetters + perfil.origenSetters * (generadas / r.generadas) : 1;
    const nClosers = aplicar(p.closers, perfil.closers);
    const capClosers = perfil.closers > 0 ? nClosers * aplicar(p.prod_closers, perfil.agendasPorCloser) * (1 + holgura) : Infinity;
    const agendasPedidas = aplicar(p.agendas, r.agendas * seguir);
    const agendas = Math.min(agendasPedidas, capClosers);

    const realizadas = agendas * perfil.fRealizadas;
    const showUp = Math.min(1, aplicar(p.show_up, perfil.showUp, 100));
    const asistieron = realizadas * showUp;
    const closeRate = Math.min(1, aplicar(p.close_rate, perfil.closeRate, 100));
    const ventas = asistieron * closeRate;

    const ticket = aplicar(p.ticket, perfil.ticket);
    // Las ventas nuevas valen ventas × ticket; sin ventas en la base, se parte del ticket.
    const cashNuevas = r.ventas > 0 && perfil.ticket > 0
        ? r.cashNuevas * (ventas / r.ventas) * (ticket / perfil.ticket)
        : ventas * ticket;
    const cashOtros = Math.max(0, r.cash - r.cashNuevas);
    const cash = cashNuevas + cashOtros;
    const neto = cash * perfil.netoSobreCash;

    return {
        gasto, cpl, entAds, entrantes, aperturas, generadas, agendas, realizadas, asistieron, ventas,
        cashNuevas, cash, neto, showUp, closeRate, ticket, ticketPond: ticket * ventas,
        comCloser: neto * perfil.comisiones.closers,
        comSetter: neto * perfil.ventasSetters * perfil.comisiones.setters,
        sinAtenderSetters: Math.max(0, generadasPedidas - generadas),
        sinAtenderClosers: Math.max(0, agendasPedidas - agendas),
    };
};

const SUMABLES = ['gasto', 'entAds', 'entrantes', 'aperturas', 'generadas', 'agendas', 'asistieron', 'ventas',
    'cashNuevas', 'cash', 'neto', 'ticketPond', 'comCloser', 'comSetter', 'sinAtenderSetters', 'sinAtenderClosers'];

/**
 * Proyecta los meses del horizonte: `{meses: [{...mes, base, esc}], total: {base, esc}}`.
 * `ya` son las sumas del mes en curso hasta ayer (crudos de la ventana `mes`): lo que ya pasó es
 * real, igual en base y escenario; las palancas solo mueven los días que faltan.
 */
export const proyectar = (perfil, meses, ya, palancas, holgura) => {
    const dBase = diaHabil(perfil, {}, holgura);
    const dEsc = diaHabil(perfil, palancas, holgura);
    const real = ya || vacios();
    const realCom = {
        comCloser: (real.neto || 0) * perfil.comisiones.closers,
        comSetter: (real.neto || 0) * perfil.ventasSetters * perfil.comisiones.setters,
    };
    const mes = (m, dia) => {
        const hist = m.actual ? { ...real, ...realCom } : {};
        const dias = m.actual ? m.restantes : m.habiles;
        return Object.fromEntries(SUMABLES.map(k => [k, (hist[k] || 0) + (dia[k] || 0) * dias]));
    };
    const filas = meses.map(m => ({ ...m, base: mes(m, dBase), esc: mes(m, dEsc) }));
    const suma = (lado) => Object.fromEntries(SUMABLES.map(k => [k, filas.reduce((s, m) => s + m[lado][k], 0)]));
    return { meses: filas, total: { base: suma('base'), esc: suma('esc') }, dia: { base: dBase, esc: dEsc } };
};

/** Las cifras derivadas de un total: close rate, ticket, costo por lead y retorno de anuncios. */
export const derivadas = (t, perfil) => ({
    closeRate: div(t.ventas, t.asistieron),
    // El ticket del tablero (ver `perfilDe`), ponderado por las ventas de cada tramo.
    ticket: div(t.ticketPond, t.ventas),
    cpl: div(t.gasto, t.entAds),
    roas: t.gasto > 0 ? (t.cash * perfil.cobradoAnuncios) / t.gasto : null,
});

/** Variación entre base y escenario: `{abs, pct}`; `pct` es null si la base es cero. */
export const variacion = (base, esc) => ({
    abs: esc - base,
    pct: Math.abs(base) > 1e-9 ? ((esc - base) / Math.abs(base)) * 100 : null,
});

/** Retorno de cada dólar de anuncios extra: Δcash ÷ Δinversión (null si la inversión no cambió). */
export const retornoMarginal = (total) => {
    const dGasto = total.esc.gasto - total.base.gasto;
    return Math.abs(dGasto) >= 1 ? (total.esc.cash - total.base.cash) / dGasto : null;
};

export { aIso, deIso, tocada, div };
