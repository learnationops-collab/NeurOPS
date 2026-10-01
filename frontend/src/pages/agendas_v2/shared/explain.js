// La estrategia leída en castellano. Es la prueba de que el sistema la interpreta igual que el
// director: si una frase de acá no coincide con lo que quiso configurar, el error está a la vista.

import { closerPorId, PREGUNTAS } from './mockData';

const nombre = (id) => closerPorId(id)?.nombre.split(' ')[0] || id;
const textoPregunta = (id) => PREGUNTAS.find(p => p.id === id)?.texto || id;

function lista(nombres) {
    if (nombres.length <= 1) return nombres.join('');
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function explicarEstrategia(estrategia) {
    const bloques = [];

    const pesos = Object.entries(estrategia.scoring).sort((a, b) => b[1].peso - a[1].peso);
    const mayor = pesos[0];
    bloques.push({
        titulo: 'Puntaje',
        frases: [
            `El puntaje va de 0 a 100 y combina ${pesos.length} preguntas.`,
            mayor ? `La que más pesa es “${textoPregunta(mayor[0])}” (×${mayor[1].peso}).` : null,
            ...(estrategia.descalificadores || []).map(d => `Si responde “${d.opcion}”, va directo a ${d.segmento} sin importar el puntaje.`),
        ].filter(Boolean),
    });

    const segs = [...estrategia.segmentos].sort((a, b) => b.desde - a.desde);
    bloques.push({
        titulo: 'Segmentos',
        frases: segs.map((s, i) => {
            const techo = i === 0 ? 100 : segs[i - 1].desde - 1;
            return `${s.id} · ${s.nombre}: de ${s.desde} a ${techo} puntos.`;
        }),
    });

    for (const s of segs) {
        const cfg = estrategia.enrutamiento[s.id];
        if (!cfg) continue;
        const frases = [];
        const nombres = cfg.cola.map(c => nombre(c.closer));
        if (!nombres.length) frases.push('No tiene closers asignados: estos leads no se pueden agendar.');
        else if (cfg.modo === 'prioridad') frases.push(`Se llena primero ${nombres[0]}${nombres.length > 1 ? `; cuando llega a su tope, sigue ${lista(nombres.slice(1))}, en ese orden` : ''}.`);
        else if (cfg.modo === 'simetrico') frases.push(`Se reparte parejo entre ${lista(nombres)}: le toca al que menos lleva.`);
        else frases.push(`Se reparte en proporción: ${lista(cfg.cola.map(c => `${nombre(c.closer)} ${c.peso || 1}`))}.`);
        for (const c of cfg.cola) {
            if (c.min != null) frases.push(`${nombre(c.closer)} tiene garantizadas ${c.min} por semana: hasta cumplirlas, va primero.`);
            if (c.max != null) frases.push(`${nombre(c.closer)} recibe como máximo ${c.max} por semana.`);
        }
        frases.push(cfg.desborde ? `Si todos llegan a su tope, el lead pasa a la cola de ${cfg.desborde}.` : 'Si todos llegan a su tope, el lead se queda sin horarios.');
        bloques.push({ titulo: `Reparto ${s.id}`, frases });
    }

    const n = estrategia.oferta?.minHorarios48h ?? 1;
    bloques.push({
        titulo: 'Horarios',
        frases: [`Si los closers preferidos no suman ${n} horarios en las próximas 48 h, se agrega el siguiente de la cola hasta llegar.`],
    });
    return bloques;
}
