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
 * El embudo (dolor, oferta, link) y los follow-ups van en total; las agendas, por canal. Desde el
 * 11/10/2026 cada follow-up lleva también cuántos respondieron (`followups_respondidos`), para el %
 * de respuesta que pidió Kerwin.
 *
 * Correcciones del dueño del 15/10/2026:
 *   · Los cualificados SE CARGAN: son los leads de cada canal (`leads`). Antes eran entrantes − no
 *     leads − in-abribles y el que no contestaba contaba como cualificado; lo que sobra ahora son
 *     los que no contestaron.
 *   · Cada apertura lleva cuántos respondieron (`ap_entrantes_resp`, `ap_dolor_resp` y, en las
 *     bienvenidas, `aperturas_resp`): «una cosa es las aperturas que hicieron y otra lo que
 *     respondieron».
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

const canalVacio = () => ({
    entrantes: 0, leads: 0, no_lead: 0, inabribles: 0,
    ap_entrantes: 0, ap_dolor: 0, ap_entrantes_resp: 0, ap_dolor_resp: 0, agendas: 0,
});

/** Un reporte en cero: la forma de `vacio()` del backend, con los campos del 15/10. */
export const vacio = () => ({
    anuncios: canalVacio(),
    inbound: canalVacio(),
    bienvenidas: { hechas: 0, respondidas: 0, aperturas: 0, aperturas_resp: 0 },
    embudo: { dolor: 0, oferta: 0, link: 0 },
    followups: { entrantes: 0, dolor: 0, oferta: 0, link: 0 },
    followups_respondidos: { entrantes: 0, dolor: 0, oferta: 0, link: 0 },
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

/** Los cualificados de un canal: los entrantes cualificados que cargó el setter menos los no leads. */
export const netoDe = (d) => Math.max(0, (d?.leads || 0) - (d?.no_lead || 0));

/** Los mensajes que no son entrantes cualificados (los no leads van adentro) ni in-abribles: no contestaron. */
export const noContestaronDe = (d) => Math.max(0,
    (d?.entrantes || 0) - (d?.leads || 0) - (d?.inabribles || 0));

/**
 * Las cuentas del reporte: cada número que se muestra, los avisos y la marca de cada celda.
 *
 * Son advertencias: se ven, pintan la celda y el paso, pero el setter puede tener una razón (abrió
 * en dolor a alguien que entró ayer) y el reporte sale igual. Ninguna bloquea el envío: hasta el
 * 17/10/2026 cualificados + no leads + in-abribles por encima de los mensajes era un ERROR que no
 * dejaba enviar, y Kerwin lo sacó («dejá que los setters escriban lo que ellos consideren, hay que
 * medir lo que ellos dicen»): califican también a gente que escribió otros días. Los que no
 * contestaron quedan en 0 en ese caso (`noContestaronDe`).
 */
export function calcular(s) {
    const num = {};
    const avisos = [];
    const marcas = new Map();
    const marca = (k, nivel) => { if (marcas.get(k) !== 'err') marcas.set(k, nivel); };
    const aviso = (paso, nivel, msg) => avisos.push({ paso, nivel, msg });
    const t = { entr: 0, net: 0, ap: 0, apD: 0, ag: 0, resp: 0 };

    for (const c of CANALES) {
        const d = s[c.k];
        const net = netoDe(d);
        const ap = d.ap_entrantes + d.ap_dolor;
        const resp = d.ap_entrantes_resp + d.ap_dolor_resp;
        if (ap > d.entrantes) {
            aviso('aperturas', 'warn', `${c.n}: más aperturas que entrantes (${d.entrantes})`);
            marca(`${c.k}.ap_entrantes`, 'warn');
            marca(`${c.k}.ap_dolor`, 'warn');
        }
        for (const [k, n] of [['ap_entrantes', 'en entrantes'], ['ap_dolor', 'en dolor']]) {
            if (d[`${k}_resp`] > d[k]) {
                aviso('aperturas', 'warn', `${c.n}: más respuestas que aperturas ${n} (${d[k]})`);
                marca(`${c.k}.${k}_resp`, 'warn');
            }
        }
        Object.assign(num, {
            [`${c.k}.entr`]: d.entrantes,
            [`${c.k}.net`]: net,
            [`${c.k}.noCont`]: noContestaronDe(d),
            [`${c.k}.cualRate`]: tasa(net, d.entrantes),
            [`${c.k}.apRate`]: tasa(ap, d.entrantes),
            [`${c.k}.apTot`]: ap,
            [`${c.k}.apResp`]: resp,
            [`${c.k}.respRate`]: tasa(resp, ap),
            [`${c.k}.agendas`]: d.agendas,
            [`${c.k}.convRate`]: tasa(d.agendas, net),
        });
        t.entr += d.entrantes; t.net += net; t.ap += ap; t.apD += d.ap_dolor; t.ag += d.agendas; t.resp += resp;
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
    if (b.aperturas_resp > b.aperturas) {
        aviso('aperturas', 'warn', `Bienvenidas: más respuestas que aperturas (${b.aperturas})`);
        marca('bienvenidas.aperturas_resp', 'warn');
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

    // Cada follow-up con sus respondidos: más respuestas que envíos es un número mal cargado.
    const r = s.followups_respondidos;
    for (const [k, n] of FOLLOWUPS) {
        if (r[k] > s.followups[k]) {
            aviso('followups', 'warn', `${n}: más respuestas que follow-ups (${s.followups[k]})`);
            marca(`followups_respondidos.${k}`, 'warn');
        }
    }
    const fuTot = FOLLOWUPS.reduce((a, [k]) => a + s.followups[k], 0);
    const fuResp = FOLLOWUPS.reduce((a, [k]) => a + r[k], 0);
    Object.assign(num, {
        'tot.entr': t.entr,
        'tot.net': t.net,
        'tot.agendas': t.ag,
        'tot.cualRate': tasa(t.net, t.entr),
        'tot.apRate': tasa(t.ap, t.entr),
        'tot.apResp': t.resp,
        'tot.respRate': tasa(t.resp, t.ap),
        'tot.convRate': tasa(t.ag, t.net),
        'tot.fuTot': fuTot,
        'tot.fuResp': fuResp,
        'tot.fuRate': tasa(fuResp, fuTot),
        'bienvenidas.hechas': b.hechas,
        'bienvenidas.resp': b.respondidas,
        'bienvenidas.rate': tasa(b.respondidas, b.hechas),
        'bienvenidas.apRate': tasa(b.aperturas, b.respondidas),
        'bienvenidas.respRate': tasa(b.aperturas_resp, b.aperturas),
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
 * El tope natural de cada número: la etapa anterior, los entrantes del canal o las respuestas (los
 * respondidos de un follow-up, sus envíos). `null` si no tiene (entrantes, bienvenidas hechas,
 * follow-ups enviados): esa celda se compara con sus pares.
 */
export function referenciaDe(s, ruta) {
    const [sec, campo] = ruta.split('.');
    if (sec === 'bienvenidas') {
        if (campo === 'respondidas') return s.bienvenidas.hechas;
        if (campo === 'aperturas') return s.bienvenidas.respondidas;
        if (campo === 'aperturas_resp') return s.bienvenidas.aperturas;
        return null;
    }
    if (sec === 'embudo') {
        return { dolor: netoDe(s.anuncios) + netoDe(s.inbound), oferta: s.embudo.dolor, link: s.embudo.oferta }[campo];
    }
    if (sec === 'followups') return null;
    if (sec === 'followups_respondidos') return s.followups[campo];
    if (['leads', 'no_lead', 'inabribles', 'ap_entrantes', 'ap_dolor'].includes(campo)) return s[sec].entrantes;
    if (campo === 'ap_entrantes_resp' || campo === 'ap_dolor_resp') return s[sec][campo.replace('_resp', '')];
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
    // Un reporte de antes del 15/10 no trae leads (null): sus cualificados eran la cuenta vieja (ya sin
    // los no leads), y se rellena el campo con ellos más los no leads para que editarlo no los cambie.
    // Las respuestas a las aperturas que no cargó vuelven en cero: hay que completarlas.
    const canal = (d) => ({ ...d, leads: d.leads ?? (d.cualificados + (d.no_lead || 0)) });
    return fusionar(vacio(), {
        ...(l.canales ? { anuncios: canal(l.canales.anuncios), inbound: canal(l.canales.inbound) } : {}),
        ...(l.bienvenidas ? { bienvenidas: l.bienvenidas } : {}),
        embudo: l.embudo,
        followups: l.followups,
        followups_respondidos: l.followups_respondidos,
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
    followups_respondidos: { ...s.followups_respondidos },
    reflexion: { ...s.reflexion },
    is_non_working_day: Boolean(s.is_non_working_day),
});

/**
 * Lo que el formulario toma de la precarga del sistema: solo las agendas de cada canal. Los nuevos
 * mensajes, los no leads y los in-abribles los cuenta el setter (Kerwin, 17/10/2026: «los entrantes
 * no deberían ser los de ManyChat, sino lo que pongan los setters»): ManyChat cuenta solo a quien
 * escribió por primera vez ese día, y el setter también trabaja con los que escribieron otros días,
 * así que sus cualificados superaban esos mensajes y el reporte no se podía enviar.
 */
export const CAMPOS_PRECARGADOS = ['agendas'];

/**
 * La precarga del sistema, sin pisar lo que el setter ya escribió: `tocados` son las rutas que
 * cambió a mano (en esta sesión o en su borrador). Del prefill se toma `CAMPOS_PRECARGADOS`; el
 * resto queda como está.
 */
export function aplicarPrecarga(s, precarga, tocados) {
    let out = s;
    for (const c of CANALES) {
        const p = precarga?.[c.k];
        if (!p) continue;
        for (const campo of CAMPOS_PRECARGADOS) {
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
