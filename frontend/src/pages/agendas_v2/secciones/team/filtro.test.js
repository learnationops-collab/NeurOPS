import { describe, expect, it } from 'vitest';
import { EN_CALENDAR, FACETAS, agendasDe, aplicarFacetas, condiciones, enCalendar, fichaDe } from './filtro';

const ana = { id: 'a', nombre: 'Ana' }, beto = { id: 'b', nombre: 'Beto' };
const ficha = (extra) => ({ fuente: 'Instagram', setter: 'paula', pre_call: { key: 'confirmada', label: 'Confirmada' }, post_call: { key: 'pendiente', label: 'Pendiente' }, ya_paso: false, asistio: false, ...extra });
// Dos agendas de Ana (una cruza dos franjas: dos piezas), una de Beto y un turno libre de Beto.
const piezas = [
    { tipo: 'llamada', src: 'ag', a: 1, p: ana, reserva: { id: '1' }, ficha: ficha(), funnel: 'Setting' },
    { tipo: 'llamada', src: 'ag', a: 2, p: ana, reserva: { id: '1' }, ficha: ficha(), funnel: 'Setting' },
    { tipo: 'llamada', src: 'ag', a: 3, p: ana, reserva: { id: 'n8n-7', calendar: { estado: 'rechazado' } }, ficha: ficha({ fuente: 'Taller', setter: '', asistio: true, post_call: { key: 'venta', label: 'Venta' } }) },
    { tipo: 'cancelada', src: 'cx', a: 4, p: beto, reserva: { id: '9', motivo: 'sin_evento' }, ficha: null },
    { tipo: 'libre', src: 'tl', a: 5, p: beto },
];
const de = (k) => FACETAS.find(f => f.key === k).de;

describe('Filtro completo de Available', () => {
    it('cada faceta lee la ficha de Closing, y las que no son agendas no tienen valor', () => {
        expect(piezas.map(de('tipo'))).toEqual(['Llamada', 'Llamada', 'Llamada', 'Cancelada', 'Libre']);
        expect(piezas.map(de('fuente'))).toEqual(['Instagram', 'Instagram', 'Taller', null, null]);
        expect(piezas.map(de('setter'))).toEqual(['paula', 'paula', 'Sin setter', null, null]);
        expect(piezas.map(de('funnel'))).toEqual(['Setting', 'Setting', 'Sin funnel', 'Sin funnel', null]);
        expect(piezas.map(de('confirmada'))).toEqual(['Sí', 'Sí', 'Sí', null, null]);
        expect(piezas.map(de('asistio'))).toEqual(['No', 'No', 'Sí', null, null]);
        expect(piezas.map(de('estado'))).toEqual(['Aún no ocurrió', 'Aún no ocurrió', 'Venta', null, null]);
        expect(piezas.map(de('calendar'))).toEqual([EN_CALENDAR.vigente, EN_CALENDAR.vigente, EN_CALENDAR.rechazada, EN_CALENDAR.sin_evento, null]);
    });

    it('todas o alguna, como en Revisar', () => {
        const fs = { fuente: ['Taller'], closer: ['Beto'] };
        expect(aplicarFacetas(piezas, fs, 'todas')).toEqual([]);
        expect(aplicarFacetas(piezas, fs, 'alguna').map(z => z.a)).toEqual([3, 4, 5]);
        expect(aplicarFacetas(piezas, {}, 'todas')).toBe(piezas);
        expect(condiciones(fs)).toBe(2);
    });

    it('cuenta cada agenda una vez aunque cruce dos franjas, y no cuenta canceladas ni libres', () => {
        expect(agendasDe(piezas)).toBe(2);
        expect(agendasDe(aplicarFacetas(piezas, { asistio: ['Sí'] }))).toBe(1);
    });

    it('la ficha de una agenda de n8n se busca por su id de Appointment', () => {
        const fichas = { 7: { fuente: 'Taller' }, 1: { fuente: 'Instagram' } };
        expect(fichaDe(fichas, { id: 'n8n-7' })).toEqual({ fuente: 'Taller' });
        expect(fichaDe(fichas, { id: '1' })).toEqual({ fuente: 'Instagram' });
        expect(fichaDe(fichas, { id: '2' })).toBeNull();
        expect(fichaDe({}, null)).toBeNull();
    });

    it('lo que le pasó en Calendar', () => {
        expect(enCalendar({ motivo: 'cancelada' })).toBe(EN_CALENDAR.cancelada);
        expect(enCalendar({ motivo: 'reprogramada' })).toBe(EN_CALENDAR.cancelada);
        expect(enCalendar({})).toBe(EN_CALENDAR.vigente);
    });
});
