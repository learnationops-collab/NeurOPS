/**
 * El reporte diario del setter (v2): su forma, sus cuentas y sus avisos.
 *
 * Es el `blank()`/`calcular()` del diseño que aprobó Kerwin el 10/10/2026, con los nombres del
 * backend (`app/services/setter_reporte_v2.py`): lo que se carga, lo que se manda y lo que vuelve
 * de `leer()` tienen la misma forma, así que acá no hay traducciones de ida y vuelta.
 *
 * Todo lo de este archivo es puro (sin React ni DOM): el formulario, el Historial y los tests lo
 * usan igual.
 *
 * Los cualificados no se cargan: son entrantes − no leads − in-abribles, por canal. El embudo
 * (dolor, oferta, link) y los follow-ups van en total; las agendas, por canal.
 */

export const CANALES = [
    { k: 'anuncios', n: 'Anuncios', c: 'var(--ch-ads)' },
    { k: 'inbound', n: 'Inbound', c: 'var(--ch-inb)' },
];

export const BIENVENIDAS = { k: 'bienvenidas', n: 'Bienvenidas', c: 'var(--ch-bnv)' };
export const AMBOS = { k: 'tot', n: 'Ambos canales', c: 'var(--ch-tot)', mezcla: true };

export const ETAPAS = [['dolor', 'Dolor'], ['oferta', 'Oferta'], ['link', 'Link']];
export const FOLLOWUPS = [['entrantes', 'Entrantes'], ['dolor', 'Dolor'], ['oferta', 'Oferta'], ['link', 'Link']];

export const PASOS = [
    { k: 'entrantes', n: 'Entrantes' },
    { k: 'aperturas', n: 'Aperturas' },
    { k: 'embudo', n: 'Embudo' },
    { k: 'followups', n: 'Follow-ups' },
    { k: 'reflexion', n: 'Reflexión' },
    { k: 'resumen', n: 'Resumen' },
];

const canalVacio = () => ({ entrantes: 0, no_lead: 0, inabribles: 0, ap_entrantes: 0, ap_dolor: 0, agendas: 0 });

/** Un reporte en cero: la forma de `vacio()` del backend. */
export const vacio = () => ({
    anuncios: canalVacio(),
    inbound: canalVacio(),
    bienvenidas: { hechas: 0, respondidas: 0, aperturas: 0 },
    embudo: { dolor: 0, oferta: 0, link: 0 },
    followups: { entrantes: 0, dolor: 0, oferta: 0, link: 0 },
    reflexion: { flujo_trabajo: '', win_del_dia: '' },
    is_non_working_day: false,
});

export const leerRuta = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

/** Devuelve una copia con `ruta` cambiada: el estado de React no se muta. */
export const conRuta = (o, ruta, valor) => {
    const [k, ...resto] = ruta.split('.');
    return { ...o, [k]: resto.length ? conRuta(o[k] || {}, resto.join('.'), valor) : valor };
};

/**
 * Copia sobre la forma de `vacio()` lo que venga de otro lado (el backend, un borrador viejo):
 * solo las claves conocidas, los números como enteros ≥ 0 y los textos como texto. Un borrador
 * guardado con otra forma no mete claves sueltas en el estado.
 */
export const fusionar = (base, src) => {
    if (!src || typeof src !== 'object') return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(base)) {
        if (!(k in src)) continue;
        const b = base[k], v = src[k];
        if (b && typeof b === 'object') out[k] = fusionar(b, v);
        else if (typeof b === 'number') out[k] = entero(v);
        else if (typeof b === 'boolean') out[k] = Boolean(v);
        else out[k] = v == null ? '' : String(v);
    }
    return out;
};

export const entero = (v) => {
    const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? Math.min(99999, Math.max(0, n)) : 0;
};

export const tasa = (a, b) => (b > 0 ? (a / b) * 100 : null);

export const fmtInt = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('es'));
export const fmtPct = (v) => (v === null || v === undefined ? '—' : `${(Math.round(v * 10) / 10).toLocaleString('es')}%`);

export const netoDe = (d) => Math.max(0, (d?.entrantes || 0) - (d?.no_lead || 0) - (d?.inabribles || 0));

/**
 * Las cuentas del reporte: cada número que se muestra, los avisos y la marca de cada celda.
 *
 * Un solo aviso es un ERROR: no leads + in-abribles por encima de los mensajes del canal (los
 * cualificados darían negativos). Ese bloquea el envío. El resto son advertencias: se ven, pintan
 * la celda y el paso, pero el setter puede tener una razón (abrió en dolor a alguien que entró
 * ayer) y el reporte sale igual.
 */
export function calcular(s) {
    const num = {};
    const avisos = [];
    const marcas = new Map();
    const marca = (k, nivel) => { if (marcas.get(k) !== 'err') marcas.set(k, nivel); };
    const aviso = (paso, nivel, msg) => avisos.push({ paso, nivel, msg });
    const t = { entr: 0, net: 0, ap: 0, apD: 0, ag: 0 };

    for (const c of CANALES) {
        const d = s[c.k];
        const perdidos = d.no_lead + d.inabribles;
        const net = netoDe(d);
        const ap = d.ap_entrantes + d.ap_dolor;
        if (perdidos > d.entrantes) {
            aviso('entrantes', 'err', `${c.n}: no leads e in-abribles superan los ${d.entrantes} mensajes`);
            marca(`${c.k}.no_lead`, 'err');
            marca(`${c.k}.inabribles`, 'err');
        }
        if (ap > d.entrantes) {
            aviso('aperturas', 'warn', `${c.n}: más aperturas que entrantes (${d.entrantes})`);
            marca(`${c.k}.ap_entrantes`, 'warn');
            marca(`${c.k}.ap_dolor`, 'warn');
        }
        Object.assign(num, {
            [`${c.k}.entr`]: d.entrantes,
            [`${c.k}.net`]: net,
            [`${c.k}.cualRate`]: tasa(net, d.entrantes),
            [`${c.k}.apRate`]: tasa(ap, d.entrantes),
            [`${c.k}.apTot`]: ap,
            [`${c.k}.agendas`]: d.agendas,
            [`${c.k}.convRate`]: tasa(d.agendas, net),
        });
        t.entr += d.entrantes; t.net += net; t.ap += ap; t.apD += d.ap_dolor; t.ag += d.agendas;
    }

    const b = s.bienvenidas;
    if (b.respondidas > b.hechas) {
        aviso('entrantes', 'warn', 'Bienvenidas: más respondidas que hechas');
        marca('bienvenidas.respondidas', 'warn');
    }
    if (b.aperturas > b.respondidas) {
        aviso('aperturas', 'warn', `Bienvenidas: más aperturas que respuestas (${b.respondidas})`);
        marca('bienvenidas.aperturas', 'warn');
    }

    // El embudo total: los cualificados de los dos canales hasta las agendas.
    const e = s.embudo;
    const G = [t.net, e.dolor, e.oferta, e.link, t.ag];
    const marcasG = [null, ['embudo.dolor'], ['embudo.oferta'], ['embudo.link'], CANALES.map(c => `${c.k}.agendas`)];
    const nombres = ['', 'Dolor', 'Oferta', 'Link', 'Agendas'];
    const previos = ['cualificados', 'dolor', 'oferta', 'link'];
    for (let i = 1; i < G.length; i++) {
        if (G[i] > G[i - 1]) {
            aviso('embudo', 'warn', `${nombres[i]} supera a ${previos[i - 1]} (${G[i - 1]})`);
            marcasG[i].forEach(k => marca(k, 'warn'));
        }
    }
    if (t.apD > e.dolor) {
        aviso('embudo', 'warn', `Dolor es menor que las aperturas en dolor (${t.apD})`);
        marca('embudo.dolor', 'warn');
    }

    const fuTot = FOLLOWUPS.reduce((a, [k]) => a + s.followups[k], 0);
    Object.assign(num, {
        'tot.entr': t.entr,
        'tot.net': t.net,
        'tot.agendas': t.ag,
        'tot.cualRate': tasa(t.net, t.entr),
        'tot.apRate': tasa(t.ap, t.entr),
        'tot.convRate': tasa(t.ag, t.net),
        'tot.fuTot': fuTot,
        'bienvenidas.hechas': b.hechas,
        'bienvenidas.resp': b.respondidas,
        'bienvenidas.rate': tasa(b.respondidas, b.hechas),
        'bienvenidas.apRate': tasa(b.aperturas, b.respondidas),
    });
    return { num, avisos, marcas, G, convG: G.map((v, i) => (i ? tasa(v, G[i - 1]) : null)) };
}

/** El estado de cada paso para su píldora: 'err' gana a 'warn'. */
export const estadoDelPaso = (avisos, paso) => {
    const mios = avisos.filter(a => a.paso === paso);
    if (mios.some(a => a.nivel === 'err')) return 'err';
    return mios.length ? 'warn' : null;
};

export const primerError = (avisos) => avisos.find(a => a.nivel === 'err') || null;

/**
 * El tope natural de cada número: la etapa anterior, los entrantes del canal o las respuestas.
 * `null` si no tiene (entrantes, bienvenidas hechas, follow-ups): esa celda se compara con sus pares.
 */
export function referenciaDe(s, ruta) {
    const [sec, campo] = ruta.split('.');
    if (sec === 'bienvenidas') {
        if (campo === 'respondidas') return s.bienvenidas.hechas;
        if (campo === 'aperturas') return s.bienvenidas.respondidas;
        return null;
    }
    if (sec === 'embudo') {
        return { dolor: netoDe(s.anuncios) + netoDe(s.inbound), oferta: s.embudo.dolor, link: s.embudo.oferta }[campo];
    }
    if (sec === 'followups') return null;
    if (['no_lead', 'inabribles', 'ap_entrantes', 'ap_dolor'].includes(campo)) return s[sec].entrantes;
    if (campo === 'agendas') return s.embudo.link;
    return null;
}

const paresDe = (s, ruta) => {
    const [sec, campo] = ruta.split('.');
    if (sec === 'followups') return FOLLOWUPS.map(([k]) => s.followups[k]);
    if (sec === 'bienvenidas') return [leerRuta(s, ruta)];
    return CANALES.map(c => s[c.k][campo]);
};

/** Cuánto se llena la celda (0 a 1): contra su tope natural o contra la más alta de sus pares. */
export function proporcion(s, ruta) {
    const v = leerRuta(s, ruta) || 0;
    const r = referenciaDe(s, ruta);
    if (r !== null && r !== undefined) return r > 0 ? Math.min(1, v / r) : 0;
    const m = Math.max(...paresDe(s, ruta));
    if (m <= 0) return 0;
    return ruta.startsWith('bienvenidas') ? v / Math.max(20, Math.ceil((v * 1.4) / 10) * 10) : v / m;
}

/** Hasta dónde llega un arrastre de punta a punta de la celda. */
export function topeDeArrastre(s, ruta) {
    const r = referenciaDe(s, ruta);
    if (r !== null && r !== undefined) return Math.max(r, 1);
    return Math.max(20, Math.ceil((Math.max(...paresDe(s, ruta)) * 1.5) / 10) * 10);
}

/**
 * Lo que devuelve el backend (`leer()`: `canales`, `totales`, `embudo` con cualificados y agendas,
 * `no_laborable`...) de vuelta a la forma del formulario. Un reporte v1 no tiene canales ni
 * bienvenidas: vuelven en cero, no se inventa en qué canal entró cada uno. Lo que el v1 sí tenía
 * igual (embudo y follow-ups) se conserva.
 */
export const desdeLectura = (l) => {
    if (!l) return vacio();
    return fusionar(vacio(), {
        ...(l.canales ? { anuncios: l.canales.anuncios, inbound: l.canales.inbound } : {}),
        ...(l.bienvenidas ? { bienvenidas: l.bienvenidas } : {}),
        embudo: l.embudo,
        followups: l.followups,
        reflexion: l.reflexion,
        is_non_working_day: Boolean(l.no_laborable),
    });
};

/** Lo que manda el formulario al guardar: la forma de `vacio()` más quién, qué día y `version: 2`. */
export const aPayload = (s, fecha, setterId) => ({
    setter_id: setterId,
    date: fecha,
    version: 2,
    anuncios: { ...s.anuncios },
    inbound: { ...s.inbound },
    bienvenidas: { ...s.bienvenidas },
    embudo: { ...s.embudo },
    followups: { ...s.followups },
    reflexion: { ...s.reflexion },
    is_non_working_day: Boolean(s.is_non_working_day),
});

/**
 * La precarga del sistema, sin pisar lo que el setter ya escribió: `tocados` son las rutas que
 * cambió a mano (en esta sesión o en su borrador). El prefill trae solo lo que el sistema sabe
 * (por canal: entrantes, no leads, in-abribles y agendas); el resto queda como está.
 */
export function aplicarPrecarga(s, precarga, tocados) {
    let out = s;
    for (const c of CANALES) {
        const p = precarga?.[c.k];
        if (!p) continue;
        for (const campo of ['entrantes', 'no_lead', 'inabribles', 'agendas']) {
            const ruta = `${c.k}.${campo}`;
            if (p[campo] === undefined || p[campo] === null || tocados.has(ruta)) continue;
            out = conRuta(out, ruta, entero(p[campo]));
        }
    }
    return out;
}

/** Fecha local de hoy en YYYY-MM-DD, la misma cuenta que el resto del espacio del setter. */
export const hoyIso = () => {
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const aFecha = (iso) => new Date(`${iso}T12:00:00`);
export const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Hoy · 10 oct" o "jue 9 oct" (con el año si no es el actual). */
export function textoFecha(iso, hoy = hoyIso()) {
    const d = aFecha(iso);
    const anio = d.getFullYear() !== aFecha(hoy).getFullYear() ? ` ${d.getFullYear()}` : '';
    const dm = d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '') + anio;
    return iso === hoy ? `Hoy · ${dm}` : `${d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '')} ${dm}`;
}
