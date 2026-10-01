// Motor de enrutamiento de Agendas 2.0, versión de laboratorio. Funciones puras a propósito: el
// mismo contrato se va a portar al backend (app/agendas_v2/) y estas son las reglas que sus tests
// tienen que fijar. Orden: respuestas -> puntaje -> segmento -> cola de closers -> horarios -> closer.

import { CLOSERS, closerPorId, ocupadoDemo, PREGUNTAS } from './mockData';
import { addDays, dayOfWeek, hhmmToMinutes, ymdIn, zonedToUtc } from './time';

const HORA = 3600 * 1000;

export function puntuar(estrategia, respuestas) {
    let total = 0;
    let maximo = 0;
    const detalle = [];
    for (const [preguntaId, cfg] of Object.entries(estrategia.scoring)) {
        const valores = Object.values(cfg.opciones);
        const mejor = valores.length ? Math.max(...valores) : 0;
        maximo += mejor * cfg.peso;
        const respuesta = respuestas[preguntaId];
        const puntos = respuesta != null ? (cfg.opciones[respuesta] ?? 0) : 0;
        total += puntos * cfg.peso;
        detalle.push({ preguntaId, respuesta, puntos, peso: cfg.peso, aporte: puntos * cfg.peso, mejor });
    }
    const descalificador = (estrategia.descalificadores || []).find(d => respuestas[d.pregunta] === d.opcion) || null;
    return { score: maximo ? Math.round((total / maximo) * 100) : 0, total, maximo, detalle, descalificador };
}

export function segmentoPara(estrategia, { score, descalificador }) {
    if (descalificador) return descalificador.segmento;
    const orden = [...estrategia.segmentos].sort((a, b) => b.desde - a.desde);
    return (orden.find(s => score >= s.desde) || orden[orden.length - 1]).id;
}

function ordenarCola(cfg, elegibles, asignadas) {
    const idx = (c) => cfg.cola.indexOf(c);
    let orden = [...elegibles];
    if (cfg.modo === 'simetrico') {
        orden.sort((a, b) => (asignadas[a.closer] || 0) - (asignadas[b.closer] || 0) || idx(a) - idx(b));
    } else if (cfg.modo === 'ponderado') {
        const pesoTotal = orden.reduce((s, c) => s + (c.peso || 1), 0) || 1;
        const asignTotal = orden.reduce((s, c) => s + (asignadas[c.closer] || 0), 0);
        const deficit = (c) => ((c.peso || 1) / pesoTotal) * (asignTotal + 1) - (asignadas[c.closer] || 0);
        orden.sort((a, b) => deficit(b) - deficit(a) || idx(a) - idx(b));
    }
    // Una cuota mínima sin cumplir le gana a cualquier modo: es la garantía que fijó el director.
    const debajoDelMinimo = (c) => c.min != null && (asignadas[c.closer] || 0) < c.min;
    return [...orden.filter(debajoDelMinimo), ...orden.filter(c => !debajoDelMinimo(c))];
}

function motivoDe(cfg, c, asignadas, posicion) {
    const n = asignadas[c.closer] || 0;
    if (c.min != null && n < c.min) return `Lleva ${n} de ${c.min} mínimas esta semana`;
    if (cfg.modo === 'prioridad') return posicion === 0 ? 'Primera en la cola de prioridad' : `Puesto ${posicion + 1} de la cola`;
    if (cfg.modo === 'simetrico') return `Lleva ${n} esta semana`;
    return `Peso ${c.peso || 1}, lleva ${n}`;
}

// Devuelve los closers candidatos en orden, siguiendo desbordes si el segmento está lleno.
export function rankear(estrategia, segmentoId, asignadas, visitados = []) {
    const cfg = estrategia.enrutamiento[segmentoId];
    if (!cfg) return { segmentoFinal: segmentoId, desbordes: visitados, candidatos: [], llenos: [] };
    const lleno = (c) => c.max != null && (asignadas[c.closer] || 0) >= c.max;
    const elegibles = cfg.cola.filter(c => !lleno(c) && closerPorId(c.closer));
    const llenos = cfg.cola.filter(lleno);
    if (!elegibles.length && cfg.desborde && !visitados.includes(cfg.desborde) && cfg.desborde !== segmentoId) {
        return rankear(estrategia, cfg.desborde, asignadas, [...visitados, segmentoId]);
    }
    const candidatos = ordenarCola(cfg, elegibles, asignadas)
        .map((c, i) => ({ closer: c.closer, motivo: motivoDe(cfg, c, asignadas, i) }));
    return { segmentoFinal: segmentoId, modo: cfg.modo, desbordes: visitados, candidatos, llenos: llenos.map(c => c.closer) };
}

// Horarios libres de un closer, generados desde su disponibilidad semanal en SU zona horaria.
export function horariosDeCloser(closer, reunion, ahoraUtc) {
    const paso = reunion.duracion + reunion.margen;
    const desde = ahoraUtc + reunion.avisoMinHoras * HORA;
    const hoy = ymdIn(ahoraUtc, closer.tz);
    const salida = [];
    for (let i = 0; i <= reunion.horizonteDias; i++) {
        const dia = addDays(hoy, i);
        for (const [ini, fin] of closer.semana[dayOfWeek(dia)] || []) {
            const finMin = hhmmToMinutes(fin);
            for (let t = hhmmToMinutes(ini); t + reunion.duracion <= finMin; t += paso) {
                const utc = zonedToUtc(dia.y, dia.m, dia.d, Math.floor(t / 60), t % 60, closer.tz);
                if (utc >= desde && !ocupadoDemo(closer.id, utc)) salida.push(utc);
            }
        }
    }
    return salida;
}

// Suma closers de la cola, en orden, hasta ofrecer al menos N horarios en las próximas 48 h.
// Es la perilla entre "calidad de asignación" y "velocidad para agendar".
export function ofrecerHorarios(estrategia, reunion, candidatos, ahoraUtc) {
    const minimo = estrategia.oferta?.minHorarios48h ?? 1;
    const limite48 = ahoraUtc + 48 * HORA;
    const porHorario = new Map();
    const incluidos = [];
    for (const cand of candidatos) {
        const closer = closerPorId(cand.closer);
        if (!closer) continue;
        incluidos.push(cand.closer);
        for (const utc of horariosDeCloser(closer, reunion, ahoraUtc)) {
            if (!porHorario.has(utc)) porHorario.set(utc, []);
            porHorario.get(utc).push(cand.closer);
        }
        const en48 = [...porHorario.keys()].filter(u => u <= limite48).length;
        if (en48 >= minimo) break;
    }
    const horarios = [...porHorario.entries()].sort((a, b) => a[0] - b[0]).map(([utc, closers]) => ({ utc, closers }));
    return { horarios, incluidos, enCola: candidatos.length };
}

export function decidir(estrategia, reunion, respuestas, asignadas, ahoraUtc) {
    const puntaje = puntuar(estrategia, respuestas);
    const segmento = segmentoPara(estrategia, puntaje);
    const ranking = rankear(estrategia, segmento, asignadas);
    const oferta = ofrecerHorarios(estrategia, reunion, ranking.candidatos, ahoraUtc);
    return { puntaje, segmento, ranking, oferta };
}

// Al confirmar: entre los closers libres en ese horario, gana el mejor ubicado en la cola.
export function asignarHorario(decision, utc) {
    const slot = decision.oferta.horarios.find(h => h.utc === utc);
    if (!slot) return null;
    const closer = slot.closers[0];
    const cand = decision.ranking.candidatos.find(c => c.closer === closer);
    return { closer, motivo: cand?.motivo, alternativas: slot.closers.slice(1) };
}

// PRNG con semilla: la simulación tiene que dar lo mismo cada vez que se mira.
function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// N leads al azar a través de la estrategia, asumiendo que cada uno agenda con el primer candidato.
export function simular(estrategia, asignadasIniciales, n = 120, seed = 7) {
    const rnd = mulberry32(seed);
    const asignadas = { ...asignadasIniciales };
    const porCloser = Object.fromEntries(CLOSERS.map(c => [c.id, { total: 0, S1: 0, S2: 0, S3: 0 }]));
    const porSegmento = {};
    let sinCloser = 0;
    for (let i = 0; i < n; i++) {
        const respuestas = {};
        for (const p of PREGUNTAS) {
            if (p.opciones) respuestas[p.id] = p.opciones[Math.floor(rnd() * p.opciones.length)];
        }
        const seg = segmentoPara(estrategia, puntuar(estrategia, respuestas));
        porSegmento[seg] = (porSegmento[seg] || 0) + 1;
        const { candidatos } = rankear(estrategia, seg, asignadas);
        if (!candidatos.length) { sinCloser++; continue; }
        const elegido = candidatos[0].closer;
        asignadas[elegido] = (asignadas[elegido] || 0) + 1;
        porCloser[elegido].total++;
        porCloser[elegido][seg] = (porCloser[elegido][seg] || 0) + 1;
    }
    return { n, porCloser, porSegmento, sinCloser };
}
