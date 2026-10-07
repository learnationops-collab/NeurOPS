// Formularios: puntaje, ruteo por reglas, validación de respuestas y textos personalizados.

import { conOpciones } from './catalogos';
import { normalPregunta } from './normalizar';
import { clonar, mayus, uid } from './util';

export function resumenForm(f) {
    const ps = f.preguntas;
    return {
        n: ps.length,
        puntua: ps.filter(q => conOpciones(q.tipo) && q.peso > 0).length,
        filtra: ps.filter(q => conOpciones(q.tipo) && q.opciones.some(o => o.descalifica)).length,
    };
}

// Nota de 0 a 10 con un decimal: suma de peso×puntos sobre el máximo posible (peso×10).
// Solo cuentan las preguntas con opciones, con peso, respondidas y cuya opción tiene puntos.
// Sin nada puntuable devuelve null. La nota no rutea: es información para el closer y para Stats.
export function calificar(preguntas, resp) {
    let num = 0, den = 0;
    preguntas.forEach(q => {
        if (!conOpciones(q.tipo) || !q.peso) return;
        const o = q.opciones.find(x => x.id === resp[q.id]);
        if (!o || o.puntos == null) return;
        num += q.peso * o.puntos;
        den += q.peso * 10;
    });
    return den ? Math.round(num / den * 100) / 10 : null;
}

// Una opción elegida que descalifica corta el formulario.
export function opcionDescalifica(q, resp) {
    if (!conOpciones(q.tipo)) return false;
    const o = q.opciones.find(x => x.id === resp[q.id]);
    return !!(o && o.descalifica);
}

// Ruteo: las reglas se miran en orden y la primera que se cumple decide la prioridad.
// Una regla se cumple si en cada condición el lead eligió alguna de las respuestas marcadas.
// Las reglas sin condiciones completas se saltean. Si ninguna se cumple, va a `resto`.
export function grupoPorReglas(fo, resp) {
    if (!fo) return { grupo: '', regla: null };
    const reglas = fo.reglas || [];
    for (let i = 0; i < reglas.length; i++) {
        const conds = reglas[i].cond.filter(c => c.q && c.ops.length);
        if (conds.length && conds.every(c => c.ops.includes(resp[c.q]))) return { grupo: reglas[i].grupo, regla: i };
    }
    return { grupo: fo.resto || '', regla: null };
}

export function gruposDeForm(fo) {
    const ids = [];
    if (!fo) return ids;
    fo.reglas.forEach(r => { if (r.grupo && !ids.includes(r.grupo)) ids.push(r.grupo); });
    if (fo.resto && !ids.includes(fo.resto)) ids.push(fo.resto);
    return ids;
}

// Reglas que apuntan a preguntas u opciones que ya no existen: nunca se van a cumplir.
export function reglasRotas(fo) {
    const out = [];
    (fo ? fo.reglas : []).forEach((r, i) => {
        const rota = r.cond.some(c => {
            if (!c.q) return false;
            const q = fo.preguntas.find(x => x.id === c.q);
            return !q || !conOpciones(q.tipo) || c.ops.some(o => !q.opciones.some(x => x.id === o));
        });
        if (rota) out.push(i);
    });
    return out;
}

// Revisión de la segmentación: recorre las combinaciones de respuestas de las preguntas que usan las
// reglas (sin las que descalifican) y avisa lo que no cierra. Devuelve [{k, nivel, t, regla?}]:
//  - 'sin-regla'   una regla sin condiciones completas (nunca se cumple).
//  - 'sin-destino' una regla, o «Todo lo demás» cuando le llegan casos, sin estrategia.
//  - 'nunca'       una regla que nunca decide: las de arriba ya toman todos sus casos.
//  - 'repetida'    casos que cumplen dos reglas con estrategias distintas (gana la de arriba).
//  - 'sin-cubrir'  casos que no cumplen ninguna regla: van a «Todo lo demás» (info si tiene estrategia).
// Con más de MAX_COMBOS combinaciones no las recorre: avisa las respuestas que ninguna regla menciona.
const MAX_COMBOS = 20000;
export function revisarSegmentacion(fo, nombreGrupo = (id) => id) {
    if (!fo) return [];
    const avisos = [];
    const reglas = fo.reglas.map((r, i) => ({ i, grupo: r.grupo, conds: r.cond.filter(c => c.q && c.ops.length) }));
    reglas.forEach(r => {
        if (!r.conds.length) avisos.push({ k: 'sin-regla', nivel: 'error', regla: r.i, t: 'La regla ' + (r.i + 1) + ' no tiene condiciones completas: nunca se cumple.' });
        else if (!r.grupo) avisos.push({ k: 'sin-destino', nivel: 'error', regla: r.i, t: 'La regla ' + (r.i + 1) + ' no tiene estrategia.' });
    });
    const usadas = [...new Set(reglas.flatMap(r => r.conds.map(c => c.q)))]
        .map(id => fo.preguntas.find(q => q.id === id && conOpciones(q.tipo))).filter(Boolean);
    const opciones = usadas.map(q => q.opciones.filter(o => o.texto.trim() && !o.descalifica));
    const destinoResto = fo.resto ? 'van a «Todo lo demás» (' + nombreGrupo(fo.resto) + ').' : 'quedan sin estrategia: «Todo lo demás» no tiene una.';
    const total = opciones.reduce((n, os) => n * Math.max(1, os.length), 1);

    if (usadas.length && total <= MAX_COMBOS) {
        const gana = reglas.map(() => 0), choques = new Map(), resp = {};
        let alResto = 0, ejemplo = null;
        const recorrer = (k) => {
            if (k === usadas.length) {
                const cumplen = reglas.filter(r => r.conds.length && r.conds.every(c => c.ops.includes(resp[c.q])));
                if (!cumplen.length) {
                    alResto++;
                    if (!ejemplo) ejemplo = usadas.map((q, j) => (opciones[j].find(o => o.id === resp[q.id]) || {}).texto).filter(Boolean);
                    return;
                }
                gana[cumplen[0].i]++;
                cumplen.slice(1).forEach(r => {
                    if (r.grupo === cumplen[0].grupo) return;
                    const clave = cumplen[0].i + '-' + r.i;
                    choques.set(clave, (choques.get(clave) || 0) + 1);
                });
                return;
            }
            const os = opciones[k];
            if (!os.length) { resp[usadas[k].id] = undefined; recorrer(k + 1); return; }
            os.forEach(o => { resp[usadas[k].id] = o.id; recorrer(k + 1); });
        };
        recorrer(0);
        reglas.forEach(r => {
            if (!r.conds.length || gana[r.i]) return;
            const tapa = reglas.find(x => x.i < r.i && x.conds.length && gana[x.i]);
            avisos.push({ k: 'nunca', nivel: 'warning', regla: r.i, t: 'La regla ' + (r.i + 1) + ' nunca decide: sus casos ya los toma' + (tapa ? ' la regla ' + (tapa.i + 1) : 'n las de arriba') + '. ¿Está repetida?' });
        });
        choques.forEach((n, clave) => {
            const [a, b] = clave.split('-').map(Number);
            if (!gana[b]) return; // ya avisada como «nunca»
            avisos.push({
                k: 'repetida', nivel: 'warning', regla: b,
                t: 'Las reglas ' + (a + 1) + ' y ' + (b + 1) + ' se pisan en ' + n + (n === 1 ? ' caso' : ' casos') + ' y mandan a estrategias distintas: gana la ' + (a + 1) + ' (' + nombreGrupo(reglas[a].grupo) + ').',
            });
        });
        if (alResto) {
            avisos.push({
                k: 'sin-cubrir', nivel: fo.resto ? 'info' : 'error',
                t: alResto + (alResto === 1 ? ' combinación' : ' combinaciones') + ' de respuestas no cumplen ninguna regla'
                    + (ejemplo && ejemplo.length ? ' (por ejemplo: ' + ejemplo.join(' + ') + ')' : '') + ' y ' + destinoResto,
            });
        }
        return avisos;
    }

    // Demasiadas combinaciones (o ninguna pregunta en las reglas): las respuestas que nadie menciona.
    usadas.forEach((q, k) => {
        const mencionadas = new Set(reglas.flatMap(r => r.conds.filter(c => c.q === q.id).flatMap(c => c.ops)));
        const fuera = opciones[k].filter(o => !mencionadas.has(o.id));
        if (fuera.length) {
            avisos.push({
                k: 'sin-cubrir', nivel: fo.resto ? 'info' : 'error',
                t: '«' + (q.titulo || 'Pregunta') + '»: ' + fuera.map(o => '«' + o.texto + '»').join(', ') + (fuera.length > 1 ? ' no están' : ' no está') + ' en ninguna regla. Esos leads ' + destinoResto,
            });
        }
    });
    if (!usadas.length && !fo.resto) avisos.push({ k: 'sin-destino', nivel: 'error', t: 'Todos los leads ' + destinoResto });
    return avisos;
}

export function nombreLead(resp, ejemplo) {
    const n = String(resp['c-nombre'] || ejemplo || '').trim().split(/\s+/)[0] || '';
    return n ? mayus(n) : '';
}
// {nombre} se reemplaza por el primer nombre. Si todavía no hay nombre, se borra con su coma o dos puntos.
export function personalizar(t, nombre) {
    t = String(t || '');
    if (nombre) return t.replace(/\{nombre\}/gi, nombre);
    t = t.replace(/\{nombre\}\s*[,:]?\s*/gi, '');
    return t.replace(/^([¿¡]?)(\S)/, (m, a, b) => a + b.toUpperCase());
}

// Error a mostrar para una respuesta, o '' si está bien.
export function validarRespuesta(q, v) {
    if (!v) return q.obligatoria ? (conOpciones(q.tipo) ? 'Elegí una opción.' : 'Completá este dato.') : '';
    if (q.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Revisá el correo.';
    if (q.tipo === 'telefono' && v.replace(/\D/g, '').length < 6) return 'El número parece incompleto.';
    if (q.tipo === 'instagram' && !/^[A-Za-z0-9._]{1,30}$/.test(v)) return 'Solo letras, números, puntos y guiones bajos.';
    return '';
}
export function limpiarRespuesta(q, v) {
    v = String(v || '').trim();
    if (q.tipo === 'instagram') v = v.replace(/^@+/, '').replace(/\s+/g, '');
    return v;
}

export function nuevaPregunta() { return normalPregunta({ tipo: 'opciones', titulo: '', opciones: [{ texto: '' }, { texto: '' }] }); }
export function copiarPregunta(q) { const c = clonar(q); c.id = uid('q'); c.opciones.forEach(o => { o.id = uid('o'); }); return c; }

// Copia de un formulario con ids nuevos; las reglas se remapean a las preguntas y opciones copiadas.
export function duplicarForm(fd) {
    const mq = {}, mo = {};
    const preguntas = fd.preguntas.map(q => {
        const c = copiarPregunta(q);
        mq[q.id] = c.id;
        q.opciones.forEach((o, j) => { mo[o.id] = c.opciones[j].id; });
        return c;
    });
    const reglas = fd.reglas.map(r => ({ id: uid('r'), grupo: r.grupo, cond: r.cond.map(c => ({ q: mq[c.q] || '', ops: c.ops.map(o => mo[o]).filter(Boolean) })) }));
    return { nombre: fd.nombre + ' (copia)', contacto: clonar(fd.contacto), preguntas, reglas, resto: fd.resto, fin: clonar(fd.fin) };
}
