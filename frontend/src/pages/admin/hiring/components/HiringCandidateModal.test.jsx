import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./HiringInbox', () => ({ VEREDICTO: {} }));

import { dimensionesPanel } from './HiringCandidateModal';

describe('dimensionesPanel', () => {
    it('en un monitor de 1440 x 900 no escala: es el tamaño con el que se diseñó', () => {
        const dim = dimensionesPanel(1440, 900);
        expect(dim.zoom).toBe(1);
        expect(dim.width).toBeGreaterThanOrEqual(1400);
        expect(dim.width * dim.zoom).toBeLessThanOrEqual(1440);
    });

    it('en 1920 x 1080 el panel llega a 1600px de ancho y agranda el contenido', () => {
        const dim = dimensionesPanel(1920, 1080);
        expect(dim.zoom).toBeGreaterThan(1.1);
        expect(Math.round(dim.width * dim.zoom)).toBeGreaterThanOrEqual(1598);
        expect(Math.round(dim.width * dim.zoom)).toBeLessThanOrEqual(1600);
        // nunca más alto que la pantalla
        expect(dim.height * dim.zoom).toBeLessThan(1080);
    });

    it('la escala tiene techo, aunque el monitor sea enorme', () => {
        expect(dimensionesPanel(3840, 2160).zoom).toBeLessThanOrEqual(1.35);
    });

    it('en pantallas chicas o bajas va a pantalla completa, sin escalar', () => {
        expect(dimensionesPanel(600, 900)).toBeNull();
        expect(dimensionesPanel(1366, 680)).toBeNull();
    });
});
