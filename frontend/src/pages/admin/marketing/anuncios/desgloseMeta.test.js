import { describe, expect, it } from 'vitest';
import { armarDesglose, clavesAbribles, estadoDeGrupo, ordenarDesglose, totalDelDesglose } from './desgloseMeta';

const anuncio = (id, campana, conjunto, extra = {}) => ({
    meta_ad_id: id, cuenta_id: '886943269514111', nombre: `Ad ${id}`,
    campana: `Campaña ${campana}`, campana_id: `c${campana}`, conjunto: `Conjunto ${conjunto}`, conjunto_id: `s${conjunto}`,
    estado: 'ACTIVE', clave: null, embudo: 'setting', gasto: 10, impresiones: 1000, clics: 20, clics_enlace: 10, ...extra,
});

describe('desglose de Meta Ads', () => {
    it('suma campaña › conjunto › anuncio y calcula CTR, CPC y CPM en cada nivel', () => {
        const [c1, c2] = armarDesglose([
            anuncio('1', 1, 1, { clave: 'APLICAR' }),
            anuncio('2', 1, 1, { clave: 'APLICAR', gasto: 30, impresiones: 3000, clics: 40, clics_enlace: 30 }),
            anuncio('3', 1, 2, { clave: 'GUIA', estado: 'ADSET_PAUSED' }),
            anuncio('4', 2, 3, { estado: 'CAMPAIGN_PAUSED', embudo: 'workshop' }),
        ], { APLICAR: 100, GUIA: 7 });

        expect([c1.nombre, c1.gasto, c1.impresiones, c1.anuncios, c1.activos]).toEqual(['Campaña 1', 50, 5000, 3, 2]);
        expect(c1.ctr).toBeCloseTo(1.6);
        expect(c1.cpc).toBeCloseTo(1);
        expect(c1.cpm).toBeCloseTo(10);
        // Cada palabra clave cuenta una vez en el grupo, aunque la lleven dos anuncios.
        expect([c1.claves, c1.leads]).toEqual([['APLICAR', 'GUIA'], 107]);
        const [s1, s2] = c1.hijos;
        expect([s1.gasto, s1.leads, s1.hijos.map((a) => a.nombre)]).toEqual([40, 100, ['Ad 1', 'Ad 2']]);
        expect([s2.estado, s2.hijos[0].leads]).toEqual(['PAUSED', 7]);
        expect([c2.estado, c2.leads, c2.hijos[0].hijos[0].tipo]).toEqual(['PAUSED', null, 'anuncio']);
        expect(totalDelDesglose([anuncio('1', 1, 1), anuncio('2', 1, 1)]).gasto).toBe(20);
    });

    it('sin id de campaña agrupa por el nombre', () => {
        const campanas = armarDesglose([anuncio('1', 1, 1, { campana_id: null }), anuncio('2', 1, 1, { campana_id: null })]);
        expect(campanas).toHaveLength(1);
        expect(campanas[0].hijos[0].hijos).toHaveLength(2);
    });

    it('el estado de un grupo sale de sus anuncios', () => {
        expect(estadoDeGrupo([{ estado: 'PAUSED' }, { estado: 'ACTIVE' }], 'campana')).toBe('ACTIVE');
        expect(estadoDeGrupo([{ estado: 'ADSET_PAUSED' }], 'campana')).toBe('INACTIVO');
        expect(estadoDeGrupo([{ estado: 'ADSET_PAUSED' }], 'conjunto')).toBe('PAUSED');
        expect(estadoDeGrupo([{ estado: 'DISAPPROVED' }], 'conjunto')).toBe('DISAPPROVED');
        expect(estadoDeGrupo([{ estado: 'DISAPPROVED' }, { estado: 'PAUSED' }], 'conjunto')).toBe('WITH_ISSUES');
    });

    it('ordena cada nivel y deja los vacíos al final', () => {
        const arbol = armarDesglose([anuncio('1', 1, 1, { gasto: 5 }), anuncio('2', 2, 2, { gasto: 50 }),
            anuncio('3', 2, 2, { gasto: 1, impresiones: 0 })]);
        const porGasto = ordenarDesglose(arbol, (n) => n.gasto, 'desc');
        expect(porGasto.map((c) => c.nombre)).toEqual(['Campaña 2', 'Campaña 1']);
        expect(porGasto[0].hijos[0].hijos.map((a) => a.nombre)).toEqual(['Ad 2', 'Ad 3']);
        const porCpm = ordenarDesglose(arbol, (n) => n.cpm, 'asc');
        expect(porCpm.map((c) => c.nombre)).toEqual(['Campaña 1', 'Campaña 2']);
        expect(porCpm[1].hijos[0].hijos.map((a) => a.nombre)).toEqual(['Ad 2', 'Ad 3']);
        expect(clavesAbribles(arbol)).toEqual(['c1', 'c1›s1', 'c2', 'c2›s2']);
    });
});
