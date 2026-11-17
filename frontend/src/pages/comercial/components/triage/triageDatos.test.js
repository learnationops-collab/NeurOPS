import { describe, expect, it } from 'vitest';
import { FILTROS, destinoDe, filtrar } from '../../../triage/components/triageFiltros';
import { calificacionDe, conResultado, destinosDe, embudoDe, estadoDe, fueraDe } from './triageDatos';

// Un lead por caso, como los manda `triage_filas.leads` (con `destino`), y las cuentas que daría `_sumar`.
const lead = (destino, extra = {}) => ({ id: Math.random(), destino, asistencia: '', ...extra });
const LEADS = [
    lead('asistio', { asistencia: 'Show up', calificacion: 'calificado', closing: { asistio: true, cerro: true, estado: 'asistio' } }),
    lead('asistio', { asistencia: 'Show up', calificacion: 'calificado', closing: { asistio: false, estado: 'pendiente' } }),
    lead('asistio', { asistencia: 'Show up', calificacion: 'descalificado', low_ticket: 'no_cerrado' }),
    lead('asistio', { asistencia: 'Show up', calificacion: 'seguimiento' }),
    lead('asistio', { asistencia: 'Show up' }),
    lead('no_show', { asistencia: 'No Show' }),
    lead('cancelo', { asistencia: 'Pendiente' }), // cancelada desde Confirmación: solo el servidor lo sabe
    lead('reagendo', { asistencia: 'Reagendado' }),
    lead('sin_reporte', { asistencia: 'Pendiente', ya_paso: true }),
    lead('por_ocurrir', { ya_paso: false }),
    lead('fuera', { asistencia: 'Descalificado' }),
];
const M = {
    agendas: 11, asistencias: 5, no_show: 1, canceladas: 1, reagendadas: 1, sin_reporte: 1, por_ocurrir: 1, fuera: 1,
    calificados: 2, descalificados: 1, en_seguimiento: 1, sin_calificar: 1,
    pasaron: 2, closer_asistieron: 1, closer_no_asistieron: 0, closer_cerraron: 1, closer_por_venir: 1, closer_sin_reporte: 0, closer_senas: 0,
};

describe('triage: destinos y base del % de asistencia (ADR-W145)', () => {
    it('los destinos más sin reportar hacen la base; con lo que no cuenta, las agendas', () => {
        const destinos = destinosDe(M);
        expect(destinos.map((d) => d.clave)).toEqual(['Se presentó', 'No show', 'Canceló', 'Reprogramó', 'Sin reportar']);
        expect(destinos.reduce((s, d) => s + d.n, 0)).toBe(conResultado(M));
        expect(conResultado(M)).toBe(9);
        expect(conResultado(M) + fueraDe(M).reduce((s, [n]) => s + n, 0)).toBe(M.agendas);
        expect(destinos[0].pct).toBe(55.6);
        expect(Math.round(destinos.reduce((s, d) => s + d.pct, 0))).toBe(100);
    });

    it('de los que se presentaron: las cuatro cuentas suman las asistencias', () => {
        expect(calificacionDe(M).reduce((s, c) => s + c.n, 0)).toBe(M.asistencias);
        // Una respuesta guardada de antes no trae `sin_calificar`: se saca por diferencia.
        const { sin_calificar: _, ...viejo } = M;
        expect(calificacionDe(viejo).at(-1).n).toBe(1);
    });

    it('la lista de cada cifra tiene tantas filas como la cifra', () => {
        destinosDe(M).forEach((d) => expect(filtrar(LEADS, d.filtro)).toHaveLength(d.n));
        fueraDe(M).forEach(([n, , filtro]) => expect(filtrar(LEADS, filtro)).toHaveLength(n));
        calificacionDe(M).forEach((c) => expect(filtrar(LEADS, c.filtro)).toHaveLength(c.n));
        expect(filtrar(LEADS, 'base')).toHaveLength(conResultado(M));
        expect(filtrar(LEADS, 'pasaron')).toHaveLength(M.pasaron);
    });

    it('sin `destino` (respuesta vieja) se deduce de la asistencia', () => {
        expect(destinoDe({ asistencia: 'Reagendado' })).toBe('reagendo');
        expect(destinoDe({ asistencia: 'Lead Perdido' })).toBe('fuera');
        expect(destinoDe({ asistencia: '', ya_paso: true })).toBe('sin_reporte');
        expect(FILTROS.fuera.coincide({ asistencia: 'Archivada sin reporte' })).toBe(true);
    });

    it('el reporte ya no llama «Sin reportar» a la reprogramada ni a la que asistió sin calificar', () => {
        expect(estadoDe({ destino: 'reagendo', asistencia: 'Reagendado' })).toBe('Reprogramó');
        expect(estadoDe({ destino: 'fuera', asistencia: 'Descalificado' })).toBe('Otro estado');
        expect(estadoDe({ destino: 'asistio', asistencia: 'Show up' })).toBe('Sin calificar');
        expect(estadoDe({ destino: 'sin_reporte', asistencia: 'Pendiente', ya_paso: true })).toBe('Sin reportar');
        expect(estadoDe({ destino: 'asistio', asistencia: 'Show up', calificacion: 'seguimiento' })).toBe('Lo va a pensar');
    });
});

describe('triage: embudo de seis pasos', () => {
    const { etapas, cuello } = embudoDe(M);

    it('agendas → asistieron → cualificadas → pasaron → asistieron → cerraron, con su cuenta', () => {
        expect(etapas.map((e) => e.rotulo || e.clave)).toEqual(['AGENDAS', 'ASISTIERON', 'CUALIFICADAS', 'PASARON', 'ASISTIERON', 'CERRARON']);
        expect(etapas.map((e) => e.n)).toEqual([11, 5, 2, 2, 1, 1]);
        expect(etapas.map((e) => e.de)).toEqual([undefined, 9, 5, 2, 1, 1]);
        expect(etapas[1].nota).toBe('5 de 9 con destino');
        expect(etapas[2].nota).toBe('2 de 5 asistieron · 1 no califican · 1 lo piensan · 1 sin calificar');
        expect(etapas[3].nota).toBe('2 de 2 cualificadas');
        expect(etapas[4].nota).toBe('1 de 1 con resultado · 1 por venir');
        expect(etapas[5].nota).toBe('1 de 1 asistieron');
        expect(new Set(etapas.map((e) => e.filtro)).size).toBe(6);
    });

    it('el cuello es una etapa del triage y cada etapa abre una lista de su tamaño', () => {
        expect(cuello).toBe('CUALIFICADAS');
        etapas.forEach((e) => expect(filtrar(LEADS, e.filtro)).toHaveLength(e.n));
    });
});
