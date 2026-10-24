/**
 * Las cuentas de la tabla de anuncios que hace la pantalla: los períodos, los totales de las filas que
 * se ven, el orden y la serie por día. Las de cada fila las hace el backend
 * (`app/services/anuncios_service.py`); acá se repiten las mismas fórmulas para los totales, porque
 * cambian con lo que se filtra (archivados, búsqueda) y con lo que se elige para el gráfico.
 */

const pad = (n) => String(n).padStart(2, '0');
/** Día de calendario LOCAL (`toISOString` es UTC: en UTC−3 después de las 21 ya es mañana). */
export const diaLocal = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const masDias = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);

/** Los períodos del selector, como en el Administrador de anuncios de Meta. */
export const PERIODOS = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'ultimos_7', label: 'Últimos 7 días' },
    { key: 'ultimos_30', label: 'Últimos 30 días' },
    { key: 'este_mes', label: 'Este mes' },
    { key: 'mes_pasado', label: 'Mes pasado' },
    { key: 'personalizado', label: 'Personalizado', quedaAbierto: true },
];
export const PERIODO_POR_DEFECTO = 'ultimos_30';

/** Los embudos de los anuncios de Meta (`MetaAnuncio.embudo`): adónde lleva cada anuncio. Setting es
 *  al DM (ManyChat), Workshop a la clase en vivo. Ver `meta_ads_service.detectar_embudo`. */
export const EMBUDOS = [
    { key: 'setting', label: 'Setting', color: 'var(--brand-secondary)', ayuda: 'Anuncios que llevan al DM (ManyChat): los de las palabras clave.' },
    { key: 'workshop', label: 'Workshop', color: 'var(--info)', ayuda: 'Anuncios que llevan a la clase en vivo.' },
    { key: 'contratacion', label: 'Contratación', color: 'var(--warning)', ayuda: 'Búsquedas de personal (HIRING, asistentes).' },
    { key: 'otro', label: 'Otro', color: 'var(--text-muted)', ayuda: 'Elegidos a mano como de otro embudo.' },
];

/** { desde, hasta } de un período, en días locales. `null` para «Personalizado». */
export const rangoDePeriodo = (key, hoy = new Date()) => {
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    switch (key) {
        case 'hoy': return { desde: diaLocal(h), hasta: diaLocal(h) };
        case 'ayer': return { desde: diaLocal(masDias(h, -1)), hasta: diaLocal(masDias(h, -1)) };
        case 'ultimos_7': return { desde: diaLocal(masDias(h, -6)), hasta: diaLocal(h) };
        case 'ultimos_30': return { desde: diaLocal(masDias(h, -29)), hasta: diaLocal(h) };
        case 'este_mes': return { desde: diaLocal(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: diaLocal(h) };
        case 'mes_pasado': return {
            desde: diaLocal(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
            hasta: diaLocal(new Date(h.getFullYear(), h.getMonth(), 0)),
        };
        default: return null;
    }
};

export const SUMABLES = ['entrantes', 'calificados', 'descalificados', 'en_conversacion', 'agendas', 'ventas', 'gasto',
    'cobrado'];

const division = (num, den, decimales = 2) => (den ? Number((num / den).toFixed(decimales)) : null);

/** Los porcentajes y los costos de una base con las sumas. Sin gasto, los costos son null («—»):
 *  un 0 diría que el lead salió gratis. */
export const completar = (base) => {
    const { entrantes, calificados, agendas, ventas, cobrado } = base;
    const descalificados = base.descalificados || 0;
    const enConversacion = base.en_conversacion || 0;
    const sinRespuesta = entrantes - calificados - descalificados - enConversacion;
    const gasto = Number((base.gasto || 0).toFixed(2));
    const conGasto = gasto > 0;
    return {
        ...base,
        gasto,
        no_calificados: entrantes - calificados,
        pct_calificados: division(calificados * 100, entrantes, 1),
        pct_no_calificados: division((entrantes - calificados) * 100, entrantes, 1),
        descalificados,
        en_conversacion: enConversacion,
        sin_respuesta: sinRespuesta,
        pct_descalificados: division(descalificados * 100, entrantes, 1),
        pct_en_conversacion: division(enConversacion * 100, entrantes, 1),
        pct_sin_respuesta: division(sinRespuesta * 100, entrantes, 1),
        pendientes: enConversacion + sinRespuesta,
        pct_pendientes: division((enConversacion + sinRespuesta) * 100, entrantes, 1),
        cpl: conGasto ? division(gasto, entrantes) : null,
        cpl_calificado: conGasto ? division(gasto, calificados) : null,
        costo_agenda: conGasto ? division(gasto, agendas) : null,
        costo_venta: conGasto ? division(gasto, ventas) : null,
        roas: conGasto ? division(cobrado, gasto) : null,
    };
};

export const totalesDe = (filas) => completar(Object.fromEntries(
    SUMABLES.map((k) => [k, filas.reduce((s, f) => s + (Number(f[k]) || 0), 0)]),
));

/**
 * Las columnas de la tabla, en el orden de Meta: volumen, calidad, costo, resultados. `menor`: un costo,
 * donde menos es mejor (se usa para el orden por defecto al tocar el encabezado).
 */
export const COLUMNAS = [
    { key: 'entrantes', label: 'Leads entrantes', formato: 'num',
        ayuda: 'Personas que escribieron esta palabra clave.' },
    { key: 'calificados', label: 'Calificados', formato: 'num', pct: 'pct_calificados',
        ayuda: 'Entrantes que ManyChat marcó como calificados.' },
    { key: 'descalificados', label: 'Descalificados', formato: 'num', pct: 'pct_descalificados',
        ayuda: 'ManyChat los marcó como no calificados.' },
    { key: 'en_conversacion', label: 'En conversación', formato: 'num', pct: 'pct_en_conversacion',
        ayuda: 'Respondieron, todavía sin calificar.' },
    { key: 'sin_respuesta', label: 'Sin respuesta', formato: 'num', pct: 'pct_sin_respuesta',
        ayuda: 'No contestaron la apertura.' },
    { key: 'gasto', label: 'Importe gastado', formato: 'money',
        ayuda: 'Gasto en Meta de esta palabra clave.' },
    { key: 'cpl', label: 'Costo por lead', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ leads entrantes.' },
    { key: 'cpl_calificado', label: 'Costo por calificado', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ leads calificados.' },
    { key: 'agendas', label: 'Agendas', formato: 'num',
        ayuda: 'Personas con agenda, de esta palabra clave.' },
    { key: 'costo_agenda', label: 'Costo por agenda', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ agendas.' },
    { key: 'ventas', label: 'Ventas', formato: 'num',
        ayuda: 'Pago completo o split, de esta palabra clave.' },
    { key: 'costo_venta', label: 'Costo por venta', formato: 'money', menor: true,
        ayuda: 'Importe gastado ÷ ventas.' },
    { key: 'cobrado', label: 'Cobrado', formato: 'money',
        ayuda: 'Todo lo cobrado: ventas, cuotas y señas.' },
    { key: 'roas', label: 'ROAS', formato: 'veces',
        ayuda: 'Cobrado ÷ importe gastado.' },
];

const ENTERO = new Intl.NumberFormat('en-US');

/** Un monto: con centavos si es chico (un costo por lead de $1,15 no es «$1»), sin centavos si no. */
export const dinero = (v, moneda = 'USD') => {
    if (v === null || v === undefined) return '—';
    const simbolo = moneda === 'USD' || !moneda ? '$' : `${moneda} `;
    const abs = Math.abs(v);
    const texto = abs < 100
        ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : ENTERO.format(Math.round(abs));
    return `${v < 0 ? '-' : ''}${simbolo}${texto}`;
};

export const formatear = (v, formato, moneda) => {
    if (v === null || v === undefined) return '—';
    if (formato === 'money') return dinero(v, moneda);
    if (formato === 'pct') return `${v}%`;
    if (formato === 'veces') return `${Number(v).toFixed(2)}x`;
    return ENTERO.format(v);
};

/** Ordena sin mover los «—» de abajo: un costo sin dato no es ni el mejor ni el peor. */
export const ordenar = (filas, clave, dir) => {
    const signo = dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
        const va = clave === 'nombre' ? (a.nombre || '').toLowerCase() : a[clave];
        const vb = clave === 'nombre' ? (b.nombre || '').toLowerCase() : b[clave];
        const nulaA = va === null || va === undefined;
        const nulaB = vb === null || vb === undefined;
        if (nulaA || nulaB) return nulaA === nulaB ? 0 : nulaA ? 1 : -1;
        if (va < vb) return -signo;
        if (va > vb) return signo;
        return (b.entrantes || 0) - (a.entrantes || 0);
    });
};

/**
 * La serie por día de las filas dadas, con todos los días del período (los vacíos en cero: un día sin
 * leads también es un dato). Cada fila trae `dias: { 'AAAA-MM-DD': [entrantes, calificados, gasto, agendas,
 * descalificados, en conversación] }`.
 */
/** Los días de [desde, hasta] (AAAA-MM-DD), como objetos `{ dia, ...ceros }`. */
export const diasDelRango = (desde, hasta, ceros) => {
    if (!desde || !hasta) return [];
    const [a, m, d] = desde.split('-').map(Number);
    const [a2, m2, d2] = hasta.split('-').map(Number);
    const fin = new Date(a2, m2 - 1, d2);
    const dias = [];
    for (let f = new Date(a, m - 1, d); f <= fin && dias.length < 400; f = masDias(f, 1)) {
        dias.push({ dia: diaLocal(f), ...ceros });
    }
    return dias;
};

/** El gasto de cada día por embudo (`tablero.embudos`): `[{ dia, setting, workshop, …, sin }]`. */
export const serieDeEmbudos = (embudos, desde, hasta) => {
    const claves = [...EMBUDOS.map((e) => e.key), 'sin'];
    const dias = diasDelRango(desde, hasta, Object.fromEntries(claves.map((k) => [k, 0])));
    const indice = Object.fromEntries(dias.map((x, i) => [x.dia, i]));
    (embudos || []).forEach((e) => {
        Object.entries(e.dias || {}).forEach(([dia, gasto]) => {
            const x = dias[indice[dia]];
            if (x) x[e.embudo || 'sin'] += gasto;
        });
    });
    return dias;
};

export const serieDe = (filas, desde, hasta) => {
    const dias = diasDelRango(desde, hasta,
        { entrantes: 0, calificados: 0, gasto: 0, agendas: 0, descalificados: 0, en_conversacion: 0 });
    if (!dias.length) return [];
    const indice = Object.fromEntries(dias.map((x, i) => [x.dia, i]));
    filas.forEach((fila) => {
        Object.entries(fila.dias || {}).forEach(([dia, [e, c, g, ag, d, cv]]) => {
            const x = dias[indice[dia]];
            if (!x) return;
            x.entrantes += e || 0;
            x.calificados += c || 0;
            x.gasto += g || 0;
            x.agendas += ag || 0;
            x.descalificados += d || 0;
            x.en_conversacion += cv || 0;
        });
    });
    return dias.map((x) => ({
        ...x,
        gasto: Number(x.gasto.toFixed(2)),
        // Los días sin agendas quedan en 0: no hay con qué dividir y la columna no se dibuja.
        costo_agenda: x.agendas ? Number((x.gasto / x.agendas).toFixed(2)) : 0,
        sin_respuesta: x.entrantes - x.calificados - x.descalificados - x.en_conversacion,
    }));
};

/**
 * Los tres niveles de la tabla, como en Meta. Una palabra clave tiene UNA campaña y UN conjunto (el backend
 * dice de dónde salen: a mano, Meta o la carga vieja); sus leads, agendas y ventas van enteros a ese grupo, y
 * su gasto se reparte según `gasto_por_grupo` (los anuncios de Meta de una misma palabra clave pueden estar en
 * campañas distintas).
 */
export const NIVELES = [
    { key: 'campanas', label: 'Campañas' },
    { key: 'conjuntos', label: 'Conjuntos' },
    { key: 'anuncios', label: 'Anuncios' },
];
export const SIN_CAMPANA = 'Sin campaña';
const SEP = '␟';

export const claveDeCampana = (campana) => campana ?? '';
export const claveDeConjunto = (campana, conjunto) => `${campana ?? ''}${SEP}${conjunto ?? ''}`;
export const claveDeAnuncio = (fila) => fila.clave ?? '__sin';

const SUMADAS_POR_GRUPO = ['entrantes', 'calificados', 'descalificados', 'en_conversacion', 'agendas', 'ventas',
    'cobrado'];

/** Las filas de campañas o de conjuntos a partir de las de palabras clave. */
export const agruparFilas = (filas, nivel) => {
    const porCampana = nivel === 'campanas';
    const claveDe = (c, j) => (porCampana ? claveDeCampana(c) : claveDeConjunto(c, j));
    const grupos = new Map();
    const grupo = (c, j) => {
        const id = claveDe(c, j);
        if (!grupos.has(id)) {
            grupos.set(id, {
                id, campana: c ?? null, conjunto: porCampana ? null : (j ?? null),
                nombre: porCampana ? (c ?? SIN_CAMPANA) : (j ?? (c ? 'Sin conjunto' : SIN_CAMPANA)),
                ...Object.fromEntries(SUMADAS_POR_GRUPO.map((k) => [k, 0])),
                gasto: 0, palabras: new Set(), conjuntos: new Set(), dias: {}, origenes: new Set(), medido: false,
            });
        }
        return grupos.get(id);
    };
    filas.forEach((f) => {
        const g = grupo(f.campana, f.conjunto);
        SUMADAS_POR_GRUPO.forEach((k) => { g[k] += Number(f[k]) || 0; });
        g.palabras.add(claveDeAnuncio(f));
        if (f.conjunto) g.conjuntos.add(f.conjunto);
        if (f.agrupacion) g.origenes.add(f.agrupacion);
        if (f.gasto || f.meta?.anuncios) g.medido = true;
        Object.entries(f.dias || {}).forEach(([dia, valores]) => {
            const previo = g.dias[dia] || [0, 0, 0, 0, 0, 0];
            g.dias[dia] = previo.map((v, i) => v + (valores[i] || 0));
        });
        (f.gasto_por_grupo || []).forEach(([c, j, monto]) => {
            const destino = grupo(c, j);
            destino.gasto += Number(monto) || 0;
            if (monto) destino.medido = true;
        });
    });
    return [...grupos.values()].map((g) => completar({
        ...g,
        palabras: g.palabras.size,
        conjuntos: g.conjuntos.size,
        origenes: [...g.origenes],
    }));
};

/** El texto de los anuncios de Meta de una fila: «3 anuncios en Meta · 1 activo». */
export const textoMeta = (meta) => {
    if (!meta || !meta.anuncios) return null;
    const anuncios = `${meta.anuncios} ${meta.anuncios === 1 ? 'anuncio' : 'anuncios'} en Meta`;
    if (!meta.activos) return `${anuncios} · ninguno activo`;
    return `${anuncios} · ${meta.activos} ${meta.activos === 1 ? 'activo' : 'activos'}`;
};
