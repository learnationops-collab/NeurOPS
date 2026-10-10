import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Analizar from './Analizar';
import { TABLAS, TABLAS_POR_ROL, rotuloToques } from './tablasDef';

/**
 * Cada número cliqueable del tablero de un setter lleva a SU lista, y la lista cuenta lo mismo.
 *
 * Desde el 01/10/2026 el setter tiene drill-down: un número de "Mis datos" abre su lista (Revisar
 * desde el 10/10/2026) con la tabla y el filtro de ese número. La de setters de la dirección solo
 * tiene Leads entrantes y Agendas generadas: un destino que apuntara a otra tabla no fallaría,
 * caería en la primera y con un filtro de facetas que esa tabla no tiene — la lista entera debajo
 * de un número que no es.
 *
 * El test pincha TODOS los botones del tablero real y, para cada drill-down, aplica el filtro con
 * las facetas de verdad sobre las mismas filas con las que se calcularon los números (con los
 * criterios de `totales_leads` del backend). Un número nuevo sin cuenta esperada hace fallar el
 * test: así nadie suma un número cliqueable sin decir a cuántas filas lleva.
 */

const lead = (id, { respondio = false, cualificado = false, agendo = false, mensajes = 1 } = {}) => {
    const [key, label] = agendo ? ['agendo', 'Agendó']
        : respondio ? ['en_conversacion', 'En conversación'] : ['sin_respuesta', 'Sin respuesta'];
    return {
        tipo: 'lead', id, fecha: '2026-10-01T10:00:00', cliente: `Lead ${id}`, ig: `lead${id}`,
        fuente: 'ManyChat', setter: 'Ana Setter', estado: { key, label, tone: 'info' },
        mensajes, respondio, cualificado, agendo,
    };
};

const LEADS = [
    lead(1, { respondio: true, cualificado: true, agendo: true, mensajes: 6 }),
    lead(2, { respondio: true, cualificado: true, agendo: true, mensajes: 4 }),
    lead(3, { respondio: true, cualificado: true, mensajes: 3 }),
    lead(4, { respondio: true, mensajes: 2 }),
    lead(5, { respondio: true, mensajes: 2 }),
    lead(6, { mensajes: 1 }),
    lead(7, { mensajes: 1 }),
    lead(8, { mensajes: 0 }),
];

/** El bloque de setters armado como lo arma `bloque_setters`, sobre estas mismas filas. */
const bloqueDe = (filas) => {
    const n = (cond) => filas.filter(cond).length;
    const leads = filas.length;
    const respondieron = n(f => f.respondio);
    const cualificados = n(f => f.cualificado);
    const agendas = n(f => f.agendo);
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const tenacidad = { 1: 0, 2: 0, 3: 0, '4+': 0 };
    filas.forEach(f => { if (f.mensajes > 0) tenacidad[f.mensajes >= 4 ? '4+' : f.mensajes] += 1; });
    return {
        leads, respondieron, respuesta: pct(respondieron, leads), cualificados,
        cualificacion: pct(cualificados, respondieron), agendas, conversion: pct(agendas, leads),
        mensajes: filas.reduce((a, f) => a + f.mensajes, 0), generadas: 0, show_up: null,
        ventas_originadas: 0,
        tenacidad: Object.entries(tenacidad).map(([toques, l]) => ({ toques, leads: l })),
        funnel: [{ paso: 'Entrantes', n: leads }, { paso: 'Respondieron', n: respondieron },
            { paso: 'Cualificados', n: cualificados }, { paso: 'Agendaron', n: agendas }],
    };
};

const BLOQUE = bloqueDe(LEADS);

/** A cuántas filas tiene que llevar cada número, por el nombre con el que viaja (`__de`). */
const ESPERADO = {
    Entrantes: BLOQUE.leads,
    'Tasa de respuesta': BLOQUE.respondieron,
    Agendas: BLOQUE.agendas,
    'Cualificados sobre entrantes': BLOQUE.cualificados,
    'Cualificados sobre respuesta': BLOQUE.cualificados,
    'De entrante a cita': BLOQUE.agendas,
    'De respuesta a cita': BLOQUE.agendas,
    'De cualificado a cita': BLOQUE.agendas,
    'Embudo · Entrantes': BLOQUE.leads,
    'Embudo · Respondieron': BLOQUE.respondieron,
    'Embudo · Cualificados': BLOQUE.cualificados,
    'Embudo · Agendaron': BLOQUE.agendas,
    ...Object.fromEntries(BLOQUE.tenacidad.map(t => [
        `Leads con ${rotuloToques(Number(t.toques.replace('+', '')))}`, t.leads,
    ])),
};

/** El filtro de un drill-down aplicado como lo aplica Revisar: etiquetas contra `faceta.de`. */
const filasDe = (tabla, filtro) => {
    const facetas = TABLAS[tabla].facetas;
    return LEADS.filter(f => Object.entries(filtro)
        .filter(([k]) => !k.startsWith('__'))
        .every(([k, v]) => [v].flat().includes(facetas.find(fa => fa.key === k).de(f))));
};

describe('Analizar · el tablero del setter y sus listas', () => {
    it('cada número cliqueable abre una tabla del setter, con tantas filas como dice', () => {
        const irA = vi.fn();
        const { container } = render(
            <Analizar datos={{ rol: 'setters', actual: BLOQUE, deltas: {} }} rol="setters" irA={irA} />);

        container.querySelectorAll('button').forEach(b => fireEvent.click(b));

        // Tres tiles, cinco barras (cada una con su número y su flecha), cuatro pasos y el "final"
        // del embudo, y los cuatro tramos de la tenacidad.
        expect(irA.mock.calls.length).toBeGreaterThanOrEqual(3 + 5 * 2 + 4 + 1 + 4);

        const problemas = irA.mock.calls.flatMap(([tabla, filtro]) => {
            const de = filtro.__de;
            if (!TABLAS_POR_ROL.setters.includes(tabla)) return [`${de}: la tabla ${tabla} no es del setter`];
            if (!(de in ESPERADO)) return [`${de}: número cliqueable sin cuenta esperada en el test`];
            const n = filasDe(tabla, filtro).length;
            return n === ESPERADO[de] ? [] : [`${de}: la lista tiene ${n} filas y el número dice ${ESPERADO[de]}`];
        });
        expect(problemas).toEqual([]);
    });

    it('sin a dónde ir, ningún número del setter es un botón que lleve a una lista', () => {
        const { container } = render(
            <Analizar datos={{ rol: 'setters', actual: BLOQUE, deltas: {} }} rol="setters" irA={null} />);

        expect(container.querySelectorAll('.metrica-clic, .ir-btn, .dc-funnel-label[type="button"]'))
            .toHaveLength(0);
    });
});
