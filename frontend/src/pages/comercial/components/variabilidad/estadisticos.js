/**
 * Las cuentas de las capas de Variabilidad. Todo es puro: recibe los valores de UNA serie (o
 * sub-serie) y devuelve datos; ningún componente hace aritmética por su cuenta.
 *
 * Dos reglas que atraviesan todo:
 *
 *   · **Los días que no pasaron no cuentan.** Un período en curso trae ceros hasta su último día, y
 *     contarlos baja la media y llena de «caídas» lo que todavía no ocurrió. `pasados` es cuántos
 *     días del período ya empezaron; todo se mide sobre ese tramo.
 *   · **La media y el desvío se calculan solo sobre los días con movimiento** (> 0), igual que el
 *     encabezado de una tasa: un fin de semana sin cobranza no es una caída, es un domingo. Lo que
 *     sí se avisa aparte es el día hábil que suele tener actividad y esta vez no la tuvo.
 */

/** Cuánto se aleja un día de la media (en desvíos) para salir de la banda normal. */
export const K_BANDA = 1.5;
/** Menos días con movimiento que esto y la banda es ruido: no se marca nada. */
export const MIN_ACTIVOS = 5;
/** Ventana de la media móvil, en días. */
export const VENTANA = 7;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Cuántos días del período ya empezaron (`hoy` es el día de corte del servidor). */
export const diasPasados = (dias, hoy) => {
    if (!hoy) return dias.length;
    let n = 0;
    while (n < dias.length && dias[n] <= hoy) n += 1;
    return n;
};

const diaSemana = (iso) => new Date(`${iso}T12:00:00`).getDay();
export const nombreDia = (iso) => DIAS[diaSemana(iso)];

const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Media, desvío y banda normal de una serie. `piso` es el ancho mínimo de media banda: en un conteo
 * de 1 a 3 ventas por día el desvío es tan chico que un día de 3 se marcaría como pico por
 * diferir en una venta, y eso no es información.
 */
export function banda(vals, pasados, { tipo, unidad }) {
    const activos = vals.slice(0, pasados).filter(v => v > 0);
    const media = promedio(activos);
    const desvio = Math.sqrt(promedio(activos.map(v => (v - media) ** 2)));
    const piso = tipo === 'tasa' ? 5 : unidad === '' ? 1 : 0;
    const ancho = Math.max(K_BANDA * desvio, piso);
    return {
        n: activos.length,
        media,
        desvio,
        bajo: Math.max(0, media - ancho),
        alto: media + ancho,
        confiable: activos.length >= MIN_ACTIVOS,
    };
}

/**
 * Los días que salen de lo normal, del más fuerte al más débil.
 *
 *   · `pico` / `caida`: un día con movimiento fuera de la banda.
 *   · `cero`: un día sin nada en un día de la semana que casi siempre tiene (solo en lo que se
 *     suma y con al menos dos semanas: en una tasa un cero ya es «sin llamadas»).
 */
export function atipicos(vals, dias, pasados, b, { tipo }) {
    if (!b.confiable) return [];
    const salida = [];
    for (let i = 0; i < pasados; i += 1) {
        const v = vals[i];
        if (v > b.alto) salida.push({ i, clase: 'pico', fuerza: (v - b.alto) / (b.desvio || 1) });
        else if (v > 0 && v < b.bajo) salida.push({ i, clase: 'caida', fuerza: (b.bajo - v) / (b.desvio || 1) });
    }
    if (tipo !== 'tasa' && pasados >= 14) {
        const porDia = {};
        for (let i = 0; i < pasados; i += 1) {
            const d = diaSemana(dias[i]);
            porDia[d] = porDia[d] || { total: 0, activos: 0 };
            porDia[d].total += 1;
            if (vals[i] > 0) porDia[d].activos += 1;
        }
        for (let i = 0; i < pasados; i += 1) {
            const c = porDia[diaSemana(dias[i])];
            if (vals[i] === 0 && c.activos >= 2 && c.activos / c.total >= 0.6) {
                salida.push({ i, clase: 'cero', fuerza: c.activos / c.total });
            }
        }
    }
    return salida.sort((a, b2) => b2.fuerza - a.fuerza);
}

/** Media móvil de `VENTANA` días. Una tasa promedia solo los días con movimiento de la ventana. */
export function mediaMovil(vals, pasados, { tipo }) {
    return vals.map((_, i) => {
        if (i >= pasados) return null;
        const tramo = vals.slice(Math.max(0, i - VENTANA + 1), i + 1);
        const usados = tipo === 'tasa' ? tramo.filter(v => v > 0) : tramo;
        // Con menos de tres días la «media» es el valor mismo con otro nombre.
        return i >= 2 && usados.length ? promedio(usados) : null;
    });
}

/** El acumulado día por día hasta hoy; después, null. Solo tiene sentido en lo que se suma. */
export function acumulado(vals, pasados) {
    let corrida = 0;
    return vals.map((v, i) => {
        if (i >= pasados) return null;
        corrida += v || 0;
        return corrida;
    });
}

/**
 * El ritmo: a este paso, cuánto cierra el período. Solo con un período en curso y al menos tres
 * días de datos. `meta` (si la serie la trae) lo compara contra el objetivo.
 */
export function ritmo(acum, pasados, total, meta) {
    if (pasados < 3 || pasados >= total || !acum[pasados - 1]) return null;
    const lleva = acum[pasados - 1];
    const proyeccion = (lleva / pasados) * total;
    return {
        lleva,
        proyeccion,
        meta: meta > 0 ? meta : null,
        avance: meta > 0 ? proyeccion / meta : null,
    };
}

/**
 * El total (o el promedio, en una tasa) de `vals` y de su referencia sobre los MISMOS días: los que
 * ya pasaron del período actual contra los primeros tantos del otro. Comparar un mes en curso con
 * un mes entero daría una caída que no es tal. `null` si la referencia no tiene esos días.
 */
export function contraReferencia(vals, ref, pasados, { tipo }) {
    if (!ref) return null;
    const mios = vals.slice(0, pasados);
    const suyos = ref.slice(0, pasados);
    if (!suyos.length || suyos.every(v => v === null)) return null;
    const limpios = suyos.map(v => v ?? 0);
    const f = tipo === 'tasa'
        ? (xs) => promedio(xs.filter(v => v > 0))
        : (xs) => xs.reduce((a, b) => a + b, 0);
    const actual = f(mios);
    const previo = f(limpios);
    if (tipo === 'tasa') {
        return { actual, previo, delta: { valor: Math.round((actual - previo) * 10) / 10, modo: 'pts' } };
    }
    return {
        actual,
        previo,
        delta: previo ? { valor: Math.round(((actual - previo) / previo) * 1000) / 10, modo: 'pct' } : null,
    };
}

/**
 * Qué persona explica el día `i`: su valor, cuánto se aparta de lo suyo y, en lo que se suma,
 * qué parte del salto del equipo es de ella.
 *
 * «Lo suyo» es su promedio en los días en que el equipo tuvo movimiento, así que la suma de lo
 * habitual de todos es la media del equipo y la de los desvíos de ese día es lo que el equipo se
 * apartó de su media. Una tasa no se suma: se compara cada tasa con la propia, y `pesos` (cuántas
 * llamadas o mensajes la sostienen) dice si el número vale algo.
 */
export function porPersona(personas, vals, pasados, i, { tipo }) {
    const esTasa = tipo === 'tasa';
    const activos = vals.slice(0, pasados).map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0);
    const filas = personas.map(p => {
        const base = esTasa
            ? activos.filter(k => (p.pesos ? p.pesos[k] > 0 : p.vals[k] > 0))
            : activos;
        const habitual = promedio(base.map(k => p.vals[k]));
        const hoy = p.vals[i] ?? 0;
        return {
            nombre: p.nombre,
            otros: !!p.otros,
            valor: hoy,
            peso: p.pesos ? p.pesos[i] : null,
            habitual,
            desvio: hoy - habitual,
            // Una persona sin actividad ese día en una tasa no aporta: no se compara un vacío.
            activa: esTasa ? (p.pesos ? p.pesos[i] > 0 : hoy > 0) : true,
        };
    });
    const salto = esTasa ? null : filas.reduce((a, f) => a + f.desvio, 0);
    filas.forEach(f => {
        f.parte = salto && Math.abs(salto) > 0 && f.desvio * salto > 0 ? f.desvio / salto : null;
    });
    return { filas: filas.sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)), salto };
}
