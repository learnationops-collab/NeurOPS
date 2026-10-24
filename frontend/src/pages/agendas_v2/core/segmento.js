// Segmento A/B/C/D del lead (docs/plan_segmentos_triage.md §8). Espejo de app/agendas_v2/nucleo/segmento.py.
// Puntaje = puntos obtenidos ÷ máximo de las preguntas del segmento que respondió (lo que falta no cuenta
// como 0). La confianza es la probabilidad de caer en ese segmento si los puntos tienen un error de `sigma`.

import { conOpciones } from './catalogos';

export const SEGMENTOS = ['A', 'B', 'C', 'D'];

// Normal acumulada; erf de Abramowitz y Stegun (7.1.26), igual que en Python.
function fi(x) {
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return 0.5 * (1 + (x >= 0 ? erf : -erf));
}

function banda(seg, cfg) {
    const a = cfg.a / 100, b = cfg.b / 100, c = cfg.c / 100;
    return { A: [a, Infinity], B: [b, a], C: [c, b], D: [-Infinity, c] }[seg];
}

// {segmento, puntos, preguntas, confianza, version} o null si el formulario no segmenta o falta una respuesta clave.
export function segmentar(form, resp) {
    const cfg = (form && form.segmento) || {};
    if (!cfg.activo) return null;
    let obtenido = 0, maximo = 0, respondidas = 0;
    for (const q of form.preguntas || []) {
        if (!q.segmento || !conOpciones(q.tipo)) continue;
        const pts = (q.opciones || []).filter(o => o.puntos != null).map(o => o.puntos);
        const tope = pts.length ? Math.max(...pts) : null;
        const o = (q.opciones || []).find(x => x.id === resp[q.id]);
        if (!o || o.puntos == null || !tope) {
            if (q.segmento === 'clave') return null;
            continue;
        }
        obtenido += o.puntos;
        maximo += tope;
        respondidas += 1;
    }
    if (!maximo) return null;
    const puntos = obtenido / maximo;
    const seg = SEGMENTOS.find(s => puntos >= banda(s, cfg)[0]);
    const [desde, hasta] = banda(seg, cfg);
    const sigma = cfg.sigma / 100;
    const confianza = fi((hasta - puntos) / sigma) - fi((desde - puntos) / sigma);
    return {
        segmento: seg, puntos: Math.round(puntos * 10000) / 10000, preguntas: respondidas,
        confianza: Math.round(confianza * 1000) / 1000, version: cfg.version || '',
    };
}
