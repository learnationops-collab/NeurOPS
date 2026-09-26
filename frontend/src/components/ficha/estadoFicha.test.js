import { describe, expect, it } from 'vitest';
import {
    PESTANAS,
    grupos,
    leerEstado,
    opciones,
    pestanaPorDefecto,
    pestanasVisibles,
    puedeEditarFicha,
} from './estadoFicha';
import {
    fichaAlDia,
    fichaConDeuda,
    fichaIncompleta,
    fichaPrecall,
    fichaSinReportar,
    fichaSoloLectura,
} from './__fixtures__/ficha';

const ids = (ficha) => pestanasVisibles(ficha).map(p => p.id);

describe('pestañas visibles', () => {
    it('muestra las que declara el backend, en el orden del catálogo', () => {
        expect(ids(fichaPrecall)).toEqual(['conf', 'resultado', 'hist', 'form', 'com']);
        // El payload las declara en otro orden y el tablist no se reordena por eso.
        expect(ids({ ...fichaPrecall, estado: { ...fichaPrecall.estado, pestanas: ['com', 'conf'] } }))
            .toEqual(['conf', 'com']);
    });

    it('sin lista del servidor muestra el catálogo entero', () => {
        const sinLista = { ...fichaPrecall, estado: { ...fichaPrecall.estado, pestanas: null } };
        expect(ids(sinLista)).toEqual(PESTANAS.map(p => p.id));
    });

    it('un rol sin permiso no ve la pestaña que ese permiso gobierna', () => {
        // El setter solo comenta: ni Resultado (reportar) ni Acciones (cobrar).
        expect(ids(fichaSoloLectura)).toEqual(['conf', 'hist', 'form', 'com']);
        expect(ids({ ...fichaConDeuda, permisos: { ...fichaConDeuda.permisos, cobrar: false } }))
            .not.toContain('acciones');
    });

    it('un permiso ausente o en null no esconde nada', () => {
        // Solo un `false` explícito saca la pestaña: si no, cualquier clave que el
        // backend olvide escondería media ficha.
        expect(ids({ ...fichaConDeuda, permisos: null })).toContain('acciones');
        expect(ids({ ...fichaConDeuda, permisos: { cobrar: null } })).toContain('acciones');
        expect(ids({ ...fichaConDeuda, permisos: {} })).toContain('acciones');
    });
});

describe('pestaña por defecto', () => {
    it('obedece la que manda el backend', () => {
        expect(pestanaPorDefecto(fichaPrecall)).toBe('conf');
        expect(pestanaPorDefecto(fichaSinReportar)).toBe('resultado');
        expect(pestanaPorDefecto(fichaConDeuda)).toBe('acciones');
        expect(pestanaPorDefecto(fichaAlDia)).toBe('hist');
    });

    it('cae a la primera visible si el rol no puede ver la que pidió el backend', () => {
        // El payload pide `resultado`, pero este rol no tiene permiso de reportar.
        expect(fichaSoloLectura.estado.pestana_por_defecto).toBe('resultado');
        expect(pestanaPorDefecto(fichaSoloLectura)).toBe('conf');
    });

    it('cae a la primera visible si la que pide no está en la lista declarada', () => {
        const raro = { ...fichaPrecall, estado: { ...fichaPrecall.estado, pestana_por_defecto: 'acciones' } };
        expect(pestanaPorDefecto(raro)).toBe('conf');
    });
});

describe('payloads a medias', () => {
    it('un payload con claves en null no rompe nada', () => {
        const estado = leerEstado(fichaIncompleta);
        expect(estado.pestanas.length).toBe(PESTANAS.length);
        expect(estado.porDefecto).toBe('conf');
        expect(estado.tono).toBe('idle');
        expect(estado.etiqueta).toBeNull();
    });

    it('sin ficha devuelve un estado usable, no una excepción', () => {
        expect(() => leerEstado(null)).not.toThrow();
        expect(leerEstado(undefined).porDefecto).toBe('conf');
        expect(pestanaPorDefecto({})).toBe('conf');
    });

    it('los vocabularios ausentes son listas vacías, no undefined', () => {
        expect(grupos(fichaIncompleta, 'como_viene')).toEqual([]);
        expect(grupos(null, 'dolores')).toEqual([]);
        expect(opciones(fichaIncompleta, 'closers')).toEqual([]);
        // Un grupo sin tono ni título igual sale con valores por defecto usables.
        const parcial = { vocabulario: { como_viene: [{ opciones: null }] } };
        expect(grupos(parcial, 'como_viene')).toEqual([{ titulo: 'Otros', tono: 'idle', opciones: [] }]);
    });
});

describe('puedeEditarFicha', () => {
    it('es verdadero si hay al menos un permiso de escritura', () => {
        expect(puedeEditarFicha(fichaPrecall)).toBe(true);
        expect(puedeEditarFicha(fichaSoloLectura)).toBe(true); // puede comentar
    });

    it('es falso si el rol no puede tocar nada', () => {
        const mirando = { permisos: { confirmar: false, reportar: false, cobrar: false,
            eliminar: false, reasignar: false, comentar: false } };
        expect(puedeEditarFicha(mirando)).toBe(false);
    });

    it('sin bloque de permisos asume que puede', () => {
        expect(puedeEditarFicha(fichaIncompleta)).toBe(true);
    });
});
