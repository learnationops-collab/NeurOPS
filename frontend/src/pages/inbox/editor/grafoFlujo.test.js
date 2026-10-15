import { describe, expect, it } from 'vitest';
import { aGrafo, aLienzo, conectar, INICIO, salidas } from './grafoFlujo';

const GRAFO = {
    disparadores: [{ id: 'd1', canal: 'dm', palabras: ['OBTENER GUIA'], coincidencia: 'exacta' }],
    inicio: 'perfil',
    nodos: [
        { id: 'perfil', tipo: 'mensaje', posicion: { x: 0, y: 0 }, contenido: [{ tipo: 'texto', texto: '¿Perfil?' }],
          botones: [{ id: 'medico', titulo: 'Médico' }, { id: 'est', titulo: 'Estudiante' }], sin_respuesta: { minutos: 60 } },
        { id: 'fin', tipo: 'fin', posicion: { x: 300, y: 0 } },
    ],
    conexiones: [{ id: 'c1', desde: 'perfil', salida: 'medico', hacia: 'fin' }],
};

describe('grafo ↔ lienzo', () => {
    it('ida y vuelta sin perder nada', () => {
        const { nodos, aristas } = aLienzo(GRAFO);
        expect(nodos[0].id).toBe(INICIO);
        expect(aristas[0]).toMatchObject({ source: INICIO, target: 'perfil' });

        const vuelta = aGrafo(nodos, aristas);
        expect(vuelta.inicio).toBe('perfil');
        expect(vuelta.disparadores).toEqual(GRAFO.disparadores);
        expect(vuelta.nodos).toEqual(GRAFO.nodos);
        expect(vuelta.conexiones).toEqual(GRAFO.conexiones);
    });

    it('las salidas siguen las reglas del servidor', () => {
        expect(salidas(GRAFO.nodos[0])).toEqual(['medico', 'est', 'sin_respuesta']);
        expect(salidas({ tipo: 'mensaje', espera: { guardar_en: 'x' } })).toEqual(['respuesta']);
        expect(salidas({ tipo: 'mensaje' })).toEqual(['siguiente']);
        expect(salidas({ tipo: 'condicion' })).toEqual(['si', 'no']);
        expect(salidas({ tipo: 'fin' })).toEqual([]);
    });

    it('borrar un botón suelta su rama y borrar un nodo, sus aristas', () => {
        const { nodos, aristas } = aLienzo(GRAFO);
        const sinBoton = nodos.map((n) => (n.id === 'perfil'
            ? { ...n, data: { nodo: { ...n.data.nodo, botones: [{ id: 'est', titulo: 'Estudiante' }] } } } : n));
        expect(aGrafo(sinBoton, aristas).conexiones).toEqual([]);

        const sinPerfil = nodos.filter((n) => n.id !== 'perfil');
        const g = aGrafo(sinPerfil, aristas);
        expect(g.inicio).toBe(null);
        expect(g.conexiones).toEqual([]);
    });

    it('una salida tiene una sola conexión y no se conecta un nodo consigo mismo', () => {
        let aristas = conectar([], { source: 'a', sourceHandle: 'si', target: 'b' });
        aristas = conectar(aristas, { source: 'a', sourceHandle: 'si', target: 'c' });
        expect(aristas).toHaveLength(1);
        expect(aristas[0].target).toBe('c');
        expect(conectar(aristas, { source: 'a', sourceHandle: 'no', target: 'a' })).toBe(aristas);
    });
});
