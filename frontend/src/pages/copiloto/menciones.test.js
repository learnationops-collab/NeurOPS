import { describe, expect, it } from 'vitest';
import { conMenciones, disparador, filtrarAcciones, insertar, seleccionValida, sinIds } from './menciones';

describe('menciones del chat de Learnito', () => {
    it('reconoce "/" al principio y "@" con dos letras', () => {
        expect(disparador('/com', 4)).toEqual({ tipo: 'accion', inicio: 0, fin: 4, termino: 'com' });
        expect(disparador('hola /com', 9)).toBeNull();
        expect(disparador('dejale a @K', 11)).toBeNull();
        expect(disparador('dejale a @Kev', 13)).toEqual({ tipo: 'arroba', inicio: 9, fin: 13, termino: 'Kev' });
    });

    it('filtra las acciones sin importar tildes', () => {
        const acciones = [{ clave: 'comentario', nombre: 'Comentario' }, { clave: 'observacion', nombre: 'Observación' }];
        expect(filtrarAcciones(acciones, 'obse').map((a) => a.clave)).toEqual(['observacion']);
        expect(filtrarAcciones(acciones, '')).toHaveLength(2);
    });

    it('inserta una persona en el rango o al final, y una acción al principio', () => {
        expect(insertar('dejale a @Kev hola', { inicio: 9, fin: 13 }, { tipo: 'persona', nombre: 'Kevin Santillán' }))
            .toEqual({ valor: 'dejale a @Kevin Santillán  hola', cursor: 26 });
        expect(insertar('hablá con', { inicio: 9, fin: 9, alFinal: true }, { tipo: 'equipo', nombre: 'Facundo' }).valor)
            .toBe('hablá con @Facundo ');
        expect(insertar('/co', { inicio: 0, fin: 3 }, { tipo: 'accion', clave: 'comentario' }).valor).toBe('/comentario ');
    });

    it('cada nombrado viaja con su id, el más largo primero', () => {
        const nombrados = [{ id: 1, nombre: 'Ana', tipo: 'persona' }, { id: 2, nombre: 'Ana María', tipo: 'persona' },
            { id: 9, nombre: 'Facundo', tipo: 'equipo' }];
        expect(conMenciones('avisale a @Facundo: llamá a @Ana María y a @Ana.', nombrados))
            .toBe('avisale a @[Facundo, equipo 9]: llamá a @[Ana María, id 2] y a @[Ana, id 1].');
        expect(sinIds('@[Facundo, equipo 9] y @[Ana, id 1]')).toBe('@Facundo y @Ana');
    });

    it('solo convierte selecciones cortas de una línea', () => {
        expect(seleccionValida('Kevin')).toBe(true);
        expect(seleccionValida('K')).toBe(false);
        expect(seleccionValida('una\nlínea')).toBe(false);
        expect(seleccionValida('@Kevin')).toBe(false);
    });
});
