import { describe, it, expect } from 'vitest';
import {
    cac, cuerpoDespublicar, dinero, cuerpoPublicar, estadoGrabacion, mesDe, pasosEmbudo, restante, roasRango, tasaPaso,
} from './formato';
import { ventanaGrabacion } from './datosTaller';

const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
const enHoras = (h, base = Date.now()) => local(new Date(base + h * 3600000));

describe('Talleres › formato', () => {
    it('el mes, el rango de ROAS y el CAC sin ventas', () => {
        expect(mesDe('2026-10-12')).toBe('Oct 2026');
        expect(dinero(-201.4)).toBe('-$201');
        expect(dinero(null)).toBe('—');
        expect(roasRango(0.4)).toBe('Menos de 1x');
        expect(roasRango(1.2)).toBe('1x a 1,5x');
        expect(roasRango(2)).toBe('1,5x a 3x');
        expect(roasRango(3)).toBe('3x o más');
        expect(cac({ inversion: 300, sales: 0 })).toBeNull();
        expect(cac({ inversion: 300, sales: 3 })).toBe(100);
    });

    it('el embudo corto saca los dos pasos del pitch y la tasa sin anterior es nula', () => {
        const e = { leads: 100, whatsapp_leads: 70, show_up: 30, pitch_leads: 20, pitch_final_leads: 10,
            aplicaciones_form: 8, agendas_exitosas: 6, show_up_sales_call: 4, sales: 1 };
        expect(pasosEmbudo(e).map((p) => p.key)).toHaveLength(9);
        expect(pasosEmbudo(e, { corto: true }).map((p) => p.key))
            .toEqual(['leads', 'whatsapp', 'show_up', 'aplicaciones', 'agendas', 'asistieron', 'ventas']);
        expect(tasaPaso(5, 0)).toBeNull();
        expect(tasaPaso(1, 4)).toBe(25);
    });

    it('Asistieron se mide contra las citas con resultado, y sin ese dato contra el paso anterior', () => {
        const base = { leads: 100, agendas_exitosas: 20, show_up_sales_call: 6, sales: 1 };
        const con = pasosEmbudo({ ...base, citas_reportadas: 12, citas_sin_reportar: 8 }).find((p) => p.key === 'asistieron');
        expect(con.base).toEqual({ label: 'Citas con resultado', n: 12 });
        expect(tasaPaso(con.n, con.base.n)).toBe(50);
        expect(con.ayuda).toContain('8 sin reportar');
        // Sin citas sin reportar, la ayuda no inventa faltantes.
        expect(pasosEmbudo({ ...base, citas_reportadas: 20, citas_sin_reportar: 0 }).find((p) => p.key === 'asistieron').ayuda)
            .not.toContain('sin reportar.');
        // Talleres viejos: sin el dato no hay base propia y vale el paso anterior.
        expect(pasosEmbudo(base).find((p) => p.key === 'asistieron').base).toBeUndefined();
    });

    it('el estado de la grabación: sin Loom, guardada, programada, publicada y cerrada', () => {
        const ahora = Date.now();
        expect(estadoGrabacion({}).tipo).toBe('sin_grabacion');
        expect(estadoGrabacion({ replay_loom_id: 'x' }).tipo).toBe('sin_publicar');
        const conLoom = { replay_loom_id: 'x' };
        expect(estadoGrabacion({ ...conLoom, replay_activo_desde: enHoras(2, ahora), replay_vence_hasta: enHoras(50, ahora) }, ahora).tipo).toBe('programada');
        expect(estadoGrabacion({ ...conLoom, replay_activo_desde: enHoras(-1, ahora), replay_vence_hasta: enHoras(47, ahora) }, ahora).tipo).toBe('activa');
        expect(estadoGrabacion({ ...conLoom, replay_activo_desde: enHoras(-50, ahora), replay_vence_hasta: enHoras(-2, ahora) }, ahora).tipo).toBe('vencida');
    });

    it('publicar arma desde/vence con los tiempos del taller; despublicar programada también corre el desde', () => {
        const ahora = new Date(2026, 9, 16, 10, 0);
        const cuerpo = cuerpoPublicar({ replay_loom_id: 'abc', replay_info_segundos: 30 }, { horas: 24 }, ahora);
        expect(cuerpo).toEqual({
            replay_loom_id: 'abc', replay_info_segundos: 30, replay_oferta_segundos: 120,
            replay_activo_desde: '2026-10-16T10:00', replay_vence_hasta: '2026-10-17T10:00',
        });
        expect(Object.keys(cuerpoDespublicar({ tipo: 'activa' }, ahora))).toEqual(['replay_vence_hasta']);
        expect(Object.keys(cuerpoDespublicar({ tipo: 'programada' }, ahora)).sort()).toEqual(['replay_activo_desde', 'replay_vence_hasta']);
    });

    it('la cuenta regresiva y la ventana de la landing de un taller', () => {
        expect(restante(3 * 3600000 + 5 * 60000)).toBe('3 h 05 m');
        expect(restante(12 * 60000 + 7000, { segundos: true })).toBe('12 m 07 s');
        expect(ventanaGrabacion({})).toBeNull();
        const hoy = new Date(2026, 9, 16, 12);
        expect(ventanaGrabacion({ replay_activo_desde: '2026-10-13T20:00:00', replay_vence_hasta: '2026-10-15T20:00:00' }, hoy))
            .toEqual({ desde: '2026-10-13', hasta: '2026-10-15' });
        // Todavía abierta: hasta hoy.
        expect(ventanaGrabacion({ replay_activo_desde: '2026-10-15T20:00:00', replay_vence_hasta: '2026-10-17T20:00:00' }, hoy))
            .toEqual({ desde: '2026-10-15', hasta: '2026-10-16' });
    });
});
