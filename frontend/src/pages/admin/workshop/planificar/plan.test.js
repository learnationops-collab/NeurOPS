import { describe, it, expect } from 'vitest';
import {
    agruparAcciones, borradorDesdePalanca, cuerpoAccion, estimarImpacto, siguienteTaller, talleresPorDelante,
} from './plan';

const AHORA = new Date('2026-10-12T20:15:00Z'); // el taller del 12/10 está en vivo (sigue en la landing)
const EVENTOS = [
    { id: 1, date: '2026-10-05', inicio_at: '2026-10-05T20:00:00Z' },
    { id: 2, date: '2026-10-12', inicio_at: '2026-10-12T20:00:00Z' },
    { id: 4, date: '2026-10-26', inicio_at: null },
    { id: 3, date: '2026-10-19', inicio_at: '2026-10-19T20:00:00Z' },
];

describe('Planificar › talleres por delante', () => {
    it('incluye el que está en la landing aunque haya empezado, y ordena', () => {
        expect(talleresPorDelante(EVENTOS, AHORA).map((e) => e.id)).toEqual([2, 3, 4]);
    });

    it('la acción nueva va al primero que todavía no empezó', () => {
        expect(siguienteTaller(EVENTOS, AHORA).id).toBe(3);
        expect(siguienteTaller([], AHORA)).toBeNull();
    });
});

describe('Planificar › acciones por taller', () => {
    it('reparte por taller, sin taller y de talleres que ya pasaron, pendientes primero', () => {
        const talleres = talleresPorDelante(EVENTOS, AHORA);
        const { porTaller, sinTaller, pasadas } = agruparAcciones([
            { id: 'a', event_id: 3, status: 'done', score: 5 },
            { id: 'b', event_id: 3, status: 'pending', score: 2 },
            { id: 'c', event_id: null, status: 'pending', score: 3 },
            { id: 'd', event_id: 1, status: 'pending', score: 3 },
            { id: 'e', event_id: 999, status: 'pending', score: 3 },
        ], talleres);
        expect(porTaller[3].map((a) => a.id)).toEqual(['b', 'a']);
        expect(porTaller[2]).toEqual([]);
        expect(sinTaller.map((a) => a.id)).toEqual(['c']);
        expect(pasadas.map((a) => a.id)).toEqual(['d', 'e']);
    });
});

describe('Planificar › del simulador a una acción', () => {
    it('subir una palanca arma el borrador con la etapa, los puntos y el taller', () => {
        expect(borradorDesdePalanca('asistencia', 0.28, 0.335, 3)).toMatchObject({
            stage_key: 'asistencia', target_delta_pp: 5.5, event_id: 3,
            title: 'Subir asistencia al workshop de 28% a 33.5%',
        });
    });

    it('bajarla o dejarla igual no es una acción', () => {
        expect(borradorDesdePalanca('asistencia', 0.3, 0.3)).toBeNull();
        expect(borradorDesdePalanca('asistencia', 0.3, 0.2)).toBeNull();
    });

    it('lo que viaja a la API no lleva lo que es de la vista', () => {
        const cuerpo = cuerpoAccion({ ...borradorDesdePalanca('asistencia', 0.28, 0.33, ''), note: '  ', id: 9, score: 3 });
        expect(cuerpo).not.toHaveProperty('origen');
        expect(cuerpo).not.toHaveProperty('id');
        expect(cuerpo).toMatchObject({ event_id: null, note: null, target_delta_pp: 5 });
    });

    it('el impacto aplica los puntos solo a la etapa de la acción', () => {
        const totals = { leads: 1000 };
        const rates = { whatsapp: 0.5, asistencia: 0.2, retencion_clase: 1, retencion_pitch: 1,
            conversion_form: 1, agendamiento: 1, show_up_citas: 1, close_rate: 1 };
        // techo de 95% en las tasas: 1000 × .5 × .2 × .95^6 ≈ 73.5 → con +10 pp en asistencia, ×1.5
        const { ventas, cash } = estimarImpacto({ stage_key: 'asistencia', target_delta_pp: 10 }, totals, rates, 100);
        expect(ventas).toBeCloseTo(1000 * 0.5 * 0.1 * 0.95 ** 6, 5);
        expect(cash).toBeCloseTo(ventas * 100, 5);
        expect(estimarImpacto({ stage_key: null }, totals, rates, 100)).toEqual({ ventas: 0, cash: 0 });
    });
});
