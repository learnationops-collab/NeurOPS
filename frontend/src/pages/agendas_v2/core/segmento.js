// Segmento A/B/C/D del lead (docs/plan_segmentos_triage.md §8 y §8.9). Espejo de app/agendas_v2/nucleo/segmento.py.
// Modo 'suma' (desde 2026-12): cada opción tiene `puntosSeg` (-5 a +5, de los datos; 0 = el lead promedio) y el
// puntaje es la suma de lo respondido (lo que falta suma 0). Cortes en puntos: A ≥ a, B ≥ b, C ≥ c.
// Modo proporción (el de antes): puntos obtenidos ÷ máximo de lo respondido, cortes en %.
// La confianza es la probabilidad de caer en ese segmento si los puntos tienen un error de `sigma`.

import { conOpciones } from './catalogos';

export const SEGMENTOS = ['A', 'B', 'C', 'D'];
// Pregunta virtual del ruteo: una regla puede pedir «Segmento es A o B» ({ q: SEG_Q, ops: ['A', 'B'] }).
export const SEG_Q = '__segmento';

// Normal acumulada; erf de Abramowitz y Stegun (7.1.26), igual que en Python.
function fi(x) {
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return 0.5 * (1 + (x >= 0 ? erf : -erf));
}

function banda(seg, a, b, c) {
    return { A: [a, Infinity], B: [b, a], C: [c, b], D: [-Infinity, c] }[seg];
}

// La pregunta virtual del ruteo si el formulario segmenta; null si no.
export function preguntaSegmento(form) {
    if (!(form && form.segmento && form.segmento.activo)) return null;
    return { id: SEG_Q, tipo: 'opciones', titulo: 'Segmento del lead', opciones: SEGMENTOS.map(s => ({ id: s, texto: 'Segmento ' + s })) };
}

const elegida = (q, resp) => (q.opciones || []).find(x => x.id === resp[q.id]);

function suma(form, resp, cfg) {
    let total = 0, respondidas = 0, faltan = 0;
    for (const q of form.preguntas || []) {
        if (!q.segmento || !conOpciones(q.tipo)) continue;
        if ((q.opciones || []).every(o => o.puntosSeg == null)) continue;
        const o = elegida(q, resp);
        if (!o || o.puntosSeg == null) {
            if (q.segmento === 'clave') return null;
            faltan += 1;
            continue;
        }
        total += o.puntosSeg;
        respondidas += 1;
    }
    if (!respondidas) return null;
    // Los puntos son enteros: el corte cae a mitad de camino. Lo que falta tiene el doble de error.
    return [total, respondidas, [cfg.a - 0.5, cfg.b - 0.5, cfg.c - 0.5], cfg.sigma * Math.sqrt(respondidas + 4 * faltan)];
}

function proporcion(form, resp, cfg) {
    let obtenido = 0, maximo = 0, respondidas = 0;
    for (const q of form.preguntas || []) {
        if (!q.segmento || !conOpciones(q.tipo)) continue;
        const pts = (q.opciones || []).filter(o => o.puntos != null).map(o => o.puntos);
        const tope = pts.length ? Math.max(...pts) : null;
        const o = elegida(q, resp);
        if (!o || o.puntos == null || !tope) {
            if (q.segmento === 'clave') return null;
            continue;
        }
        obtenido += o.puntos;
        maximo += tope;
        respondidas += 1;
    }
    if (!maximo) return null;
    return [obtenido / maximo, respondidas, [cfg.a / 100, cfg.b / 100, cfg.c / 100], cfg.sigma / 100];
}

// {segmento, puntos, preguntas, confianza, version} o null si el formulario no segmenta o falta una respuesta clave.
export function segmentar(form, resp) {
    const cfg = (form && form.segmento) || {};
    if (!cfg.activo) return null;
    const r = (cfg.modo === 'suma' ? suma : proporcion)(form, resp || {}, cfg);
    if (!r) return null;
    const [puntos, respondidas, cortes, sigma] = r;
    const seg = SEGMENTOS.find(s => puntos >= banda(s, ...cortes)[0]);
    const [desde, hasta] = banda(seg, ...cortes);
    const confianza = fi((hasta - puntos) / sigma) - fi((desde - puntos) / sigma);
    return {
        segmento: seg, puntos: Math.round(puntos * 10000) / 10000, preguntas: respondidas,
        confianza: Math.round(confianza * 1000) / 1000, version: cfg.version || '',
    };
}
