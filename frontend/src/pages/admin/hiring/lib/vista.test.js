import { describe, it, expect, beforeEach } from 'vitest';
import {
    agrupar, appsOn, coincide, cuentas, enPestana, filtrosActivos, guardarVista, leerVista, limpiarPais,
    minAncho, ordenar, pasaFiltros, plantillaCols, colsVisibles, vistaDefault, COLS,
} from './vista';

const p = (o) => ({
    id: 1, nombre: 'Ana', pais: 'Argentina', provincia: 'Salta', modalidad: 'hibrido', veredicto: 'sin_analizar',
    score: 50, remuneracion: '300', created_at: '2026-10-07T10:00:00', completo: true, video_ok: true, ...o,
});

describe('secciones y pestañas', () => {
    it('el Inbox separa por modalidad y deja las incompletas en su pestaña', () => {
        expect(enPestana(p(), 'pend', 'hibrido')).toBe(true);
        expect(enPestana(p(), 'pend', 'online')).toBe(false);
        expect(enPestana(p({ veredicto: 'incompleta' }), 'pend', 'incompletas')).toBe(true);
        expect(enPestana(p({ veredicto: 'incompleta' }), 'pend', 'hibrido')).toBe(false);
        expect(enPestana(p({ veredicto: 'winner' }), 'fin', 'winner')).toBe(true);
    });

    it('cuenta cada pestaña y cada sección del dock', () => {
        const c = cuentas([
            p(), p({ modalidad: 'online' }), p({ veredicto: 'incompleta', completo: false }),
            p({ veredicto: 'seleccionada' }), p({ veredicto: 'descartado' }), p({ veredicto: 'testeo' }), p({ veredicto: 'baja' }),
        ]);
        expect(c).toMatchObject({ hibrido: 1, online: 1, incompletas: 1, pend: 2, anal: 2, fin: 2, total: 7, completas: 6 });
    });
});

describe('filtrar, ordenar y agrupar', () => {
    it('busca sin importar acentos ni mayúsculas, también por provincia', () => {
        expect(coincide(p({ nombre: 'Lucía Bermúdez' }), 'lucia')).toBe(true);
        expect(coincide(p(), 'SALTA')).toBe(true);
        expect(coincide(p(), 'brasil')).toBe(false);
    });

    it('aplica los filtros de la vista', () => {
        const f = { ...vistaDefault().filtros, paises: ['Brasil'] };
        expect(pasaFiltros(p(), f)).toBe(false);
        expect(pasaFiltros(p(), { ...vistaDefault().filtros, scoreMin: 60 })).toBe(false);
        expect(pasaFiltros(p(), { ...vistaDefault().filtros, pideMax: 250 })).toBe(false);
        expect(pasaFiltros(p({ video_ok: false }), { ...vistaDefault().filtros, soloVideo: true })).toBe(false);
        expect(filtrosActivos({ filtros: { paises: ['Brasil'], soloVideo: true, scoreMin: 0, pideMax: 0 } })).toBe(2);
    });

    it('ordena por lo pedido y deja al final a quien no tiene el dato', () => {
        const l = [p({ id: 1, remuneracion: '' }), p({ id: 2, remuneracion: '400' }), p({ id: 3, remuneracion: '250' })];
        expect(ordenar(l, { campo: 'pide', dir: 'asc' }).map((x) => x.id)).toEqual([3, 2, 1]);
        expect(ordenar(l, { campo: 'pide', dir: 'desc' }).map((x) => x.id)).toEqual([2, 3, 1]);
    });

    it('agrupa por país en el orden de la búsqueda', () => {
        const g = agrupar([p({ id: 1, pais: 'Brasil' }), p({ id: 2 }), p({ id: 3, pais: 'Venezuela' })], 'pais');
        expect(g.map((x) => x.g.label)).toEqual(['Argentina', 'Venezuela', 'Brasil']);
        expect(agrupar([p()], 'none')).toEqual([{ g: null, filas: [p()] }]);
    });
});

describe('señales de la fila', () => {
    it('limpia la bandera que el formulario viejo pegaba al país', () => {
        expect(limpiarPais('🇻🇪  Venezuela')).toBe('Venezuela');
        expect(limpiarPais('Brasil')).toBe('Brasil');
        expect(limpiarPais(null)).toBe(null);
    });

    it('prende la herramienta solo si la maneja de verdad', () => {
        const on = appsOn(p({
            sheets: 'Intermedio, lo uso seguido sin ayuda', ia_nivel: 'Básico, me defiendo con lo esencial',
            wa_tools: 'Las conozco pero no las usé', automatizacion_ejemplo: 'Un Zap de leads a Sheets',
        }));
        expect(on).toMatchObject({ sheets: true, chatgpt: false, claude: false, wa: false, autom: true });
    });
});

describe('columnas y vista guardada', () => {
    beforeEach(() => window.localStorage.clear());

    it('la plantilla respeta los anchos propios y la columna fija no se esconde', () => {
        const cfg = { ...vistaDefault(), cols: ['pide'], anchos: { pide: 120 } };
        const cols = colsVisibles(cfg);
        expect(cols.map((c) => c.id)).toEqual(['cand', 'pide']);
        expect(plantillaCols(cols, cfg.anchos)).toBe('minmax(190px,1.6fr) 120px 44px');
        expect(minAncho(cols, cfg.anchos)).toBe(640);
    });

    it('guarda y lee la vista, y descarta columnas que ya no existen', () => {
        guardarVista({ ...vistaDefault(), cols: ['pide', 'fantasma'], agrupar: 'pais' });
        const v = leerVista();
        expect(v.cols).toEqual(['pide']);
        expect(v.agrupar).toBe('pais');
        expect(v.filtros).toEqual(vistaDefault().filtros);
    });

    it('con todas las columnas a 1440px la tabla entra sin scroll', () => {
        expect(minAncho(COLS, {})).toBeLessThanOrEqual(1294);
    });
});
