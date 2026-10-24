import { describe, expect, it } from 'vitest';
import { GRUPOS_COMPARACION, ganadoraDe, serieDeFuente } from './fuentes';
import { serieDe } from './metricas';

const filaDe = (key) => GRUPOS_COMPARACION.flatMap((g) => g.filas).find((f) => f.key === key);
const setting = { key: 'setting', roas_total: 2.5, roas_new_cash: 0.9, costo_agenda: 20, pct_show_up: 60, leads: 100 };
const workshop = { key: 'workshop', roas_total: 1.2, roas_new_cash: 1.1, costo_agenda: 35, pct_show_up: 40, leads: 400 };

describe('ganadoraDe', () => {
    it('el ROAS New Cash y el Total pueden coronar a fuentes distintas', () => {
        expect(ganadoraDe(filaDe('roas_new_cash'), [setting, workshop])).toBe('workshop');
        expect(ganadoraDe(filaDe('roas_total'), [setting, workshop])).toBe('setting');
    });
    it('en un costo gana el menor', () => {
        expect(ganadoraDe(filaDe('costo_agenda'), [setting, workshop])).toBe('setting');
    });
    it('el show up se corona por el porcentaje', () => {
        expect(ganadoraDe(filaDe('show_up'), [setting, workshop])).toBe('setting');
    });
    it('un volumen no se corona', () => {
        expect(ganadoraDe(filaDe('leads'), [setting, workshop])).toBeNull();
    });
    it('sin dato en una de las dos (sin gasto) o empatadas no hay ganadora', () => {
        expect(ganadoraDe(filaDe('roas_total'), [setting, { ...workshop, roas_total: null }])).toBeNull();
        expect(ganadoraDe(filaDe('roas_total'), [setting, { ...workshop, roas_total: 2.5 }])).toBeNull();
    });
});

describe('serieDeFuente', () => {
    const embudos = [{ embudo: 'workshop', dias: { '2026-10-01': 40, '2026-10-02': 30 } }];
    const fuente = { key: 'workshop', agendas_dias: { '2026-10-01': 4 } };
    it('junta gasto y agendas por día y calcula el costo por agenda', () => {
        const dias = serieDeFuente(embudos, fuente, '2026-10-01', '2026-10-03');
        expect(dias.map((d) => d.costo_agenda)).toEqual([10, 0, 0]);
        expect(dias.map((d) => d.gasto)).toEqual([40, 30, 0]);
        expect(dias.map((d) => d.agendas)).toEqual([4, 0, 0]);
    });
    it('el día con gasto y sin agendas no divide por cero', () => {
        expect(serieDeFuente(embudos, fuente, '2026-10-02', '2026-10-02')[0].costo_agenda).toBe(0);
    });
});

describe('serieDe (Setting)', () => {
    it('trae agendas y costo por agenda de cada día', () => {
        const dias = serieDe([{ dias: { '2026-10-01': [10, 5, 60, 3, 0, 0], '2026-10-02': [8, 2, 50, 0, 0, 0] } }], '2026-10-01', '2026-10-02');
        expect(dias[0]).toMatchObject({ agendas: 3, costo_agenda: 20 });
        expect(dias[1]).toMatchObject({ agendas: 0, costo_agenda: 0 });
    });
});
