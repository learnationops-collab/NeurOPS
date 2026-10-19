import { describe, expect, it } from 'vitest';
import { juntar, leerResultados, mensajeDeError } from './dictado';

describe('juntar', () => {
    it('empieza con mayúscula si no había nada', () => {
        expect(juntar('', 'nadia me pagó')).toBe('Nadia me pagó');
    });

    it('sigue la oración con un espacio', () => {
        expect(juntar('Nadia me pagó', ' quinientos dólares')).toBe('Nadia me pagó quinientos dólares');
    });

    it('después de un punto arranca otra oración', () => {
        expect(juntar('Listo.', 'ahora la cuota')).toBe('Listo. Ahora la cuota');
    });

    it('no duplica el espacio ni suma lo vacío', () => {
        expect(juntar('Hola ', 'che')).toBe('Hola che');
        expect(juntar('Hola', '  ')).toBe('Hola');
    });
});

describe('leerResultados', () => {
    const resultado = (texto, isFinal) => Object.assign([{ transcript: texto }], { isFinal });

    it('separa lo confirmado de lo provisorio desde resultIndex', () => {
        const evento = { resultIndex: 1, results: [resultado('viejo', true), resultado('hola ', true), resultado('che', false)] };
        expect(leerResultados(evento)).toEqual({ final: 'hola ', parcial: 'che' });
    });
});

describe('mensajeDeError', () => {
    it('traduce los errores y calla cuando se detuvo a mano', () => {
        expect(mensajeDeError('not-allowed')).toMatch(/micrófono/);
        expect(mensajeDeError('aborted')).toBeNull();
        expect(mensajeDeError('raro')).toMatch(/No se pudo dictar/);
    });
});
