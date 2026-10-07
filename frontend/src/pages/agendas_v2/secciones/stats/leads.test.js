// Los leads reales de Stats: el nombre del link por el que entraron, el horario de la agenda y el
// alcance de cada paso del flujo (los que agendaron pasaron por todos).

import { describe, expect, it } from 'vitest';
import { normalizarLeads, reachEvento } from './leads';

const d = {
    funnels: [{ id: 'fu', nombre: 'Workshop', origenes: [{ id: 'o1', nombre: 'Historia de IG' }] }],
    eventos: [{ id: 'ev', funnel: 'fu', formulario: 'fo' }],
    formularios: [{ id: 'fo', preguntas: [{ id: 'q1' }, { id: 'q2' }] }],
    personas: [], grupos: [], roles: [],
};
const AHORA = Date.UTC(2026, 9, 7, 12);

describe('leads reales', () => {
    it('resuelve el nombre del link y el horario de la agenda', () => {
        const inicio = new Date(2026, 9, 8, 15, 0).getTime(); // jueves 15:00 en la zona de quien mira
        const [a, b, c] = normalizarLeads(d, [
            { ev: 'ev', origen: 'historia-de-ig', agenda: true, inicio },
            { ev: 'ev', origen: '', agenda: false, inicio: null },
            { ev: 'ev', origen: 'link-viejo', agenda: false, inicio: null },
        ]);
        expect([a.origen, a.hora, a.dow]).toEqual(['Historia de IG', 15, 4]);
        expect([b.origen, b.hora, b.dow]).toEqual(['Directo', null, null]);
        expect(c.origen).toBe('link-viejo');
    });

    it('cuenta cuántos llegaron a cada paso en los últimos 30 días', () => {
        const t = AHORA - 86400000;
        const leads = [
            { ev: 'ev', t, llego: 1 }, // dejó sus datos y se fue
            { ev: 'ev', t, llego: 2 }, // respondió la primera
            { ev: 'ev', t, llego: 4, desc: false }, // llegó al calendario
            { ev: 'ev', t, llego: 999, agenda: true },
            { ev: 'ev', t: AHORA - 40 * 86400000, llego: 999, agenda: true }, // fuera de los 30 días
            { ev: 'otro', t, llego: 999, agenda: true },
        ];
        // [entraron, contacto, q1, q2, calendario, agendaron]
        expect(reachEvento(d, d.eventos[0], leads, AHORA).slice(1)).toEqual([4, 3, 2, 2, 1]);
    });
});
