import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Analizar from './Analizar';
import { TABLAS, TABLAS_POR_ROL } from './tablasDef';
import { GENERADAS, bloqueSetterEjemplo, resumenSetterEjemplo } from './bloqueSetterEjemplo';

/**
 * El tablero de setters (10/10/2026): el MISMO para la dirección y para el «Mis datos» del setter.
 *
 * Lo que se fija acá es lo que pidió el dueño en el video:
 *
 *   · Los números del sistema (lo que pasó después de la agenda y las etapas del sistema del embudo)
 *     abren su lista, y la lista cuenta lo mismo. Los del reporte no abren nada: son lo que el setter
 *     cargó, no filas.
 *   · General · Anuncios · Inbound cambia lo que el reporte separa por canal.
 *   · Poco texto: todo dato tiene su tooltip, de una oración corta.
 *   · Ya no hay «Tasa de respuesta» ni «¿Cuadra con el sistema?».
 */

const pintar = (props = {}) => render(
    <Analizar datos={resumenSetterEjemplo(props.opciones)} rol="setters" irA={props.irA ?? null}
        canal={props.canal ?? null} onCanal={props.onCanal ?? vi.fn()} />);

/** El filtro de un drill-down aplicado como lo aplica Revisar: etiquetas contra `faceta.de`. */
const filasDe = (tabla, filtro) => {
    const facetas = TABLAS[tabla].facetas;
    return GENERADAS.filter(f => Object.entries(filtro)
        .filter(([k]) => !k.startsWith('__'))
        .every(([k, v]) => [v].flat().includes(facetas.find(fa => fa.key === k).de(f))));
};

describe('Analizar · el tablero de setters y sus listas', () => {
    it('cada número del sistema abre las agendas generadas, con tantas filas como dice', () => {
        const irA = vi.fn();
        const { container } = pintar({ irA });
        const b = bloqueSetterEjemplo();

        container.querySelectorAll('button, [role=button]')
            .forEach(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

        const esperado = {
            'Agendas generadas': b.generadas, 'Agendas canceladas': b.canceladas,
            'Agendas reagendadas': b.reagendadas, 'No show': b.no_show,
            'Show up de las agendas generadas': b.asistieron, 'Ventas originadas': b.ventas_originadas,
        };
        const vistos = new Set();
        const problemas = irA.mock.calls.flatMap(([tabla, filtro]) => {
            const de = filtro.__de;
            vistos.add(de);
            if (!TABLAS_POR_ROL.setters.includes(tabla)) return [`${de}: la tabla ${tabla} no es del setter`];
            if (!(de in esperado)) return [`${de}: número cliqueable sin cuenta esperada en el test`];
            const n = filasDe(tabla, filtro).length;
            return n === esperado[de] ? [] : [`${de}: la lista tiene ${n} filas y el número dice ${esperado[de]}`];
        });

        expect(problemas).toEqual([]);
        expect([...vistos].sort()).toEqual(Object.keys(esperado).sort());
    });

    it('sin a dónde ir, ningún número es un botón que lleve a una lista', () => {
        const { container } = pintar({ irA: null });

        expect(container.querySelectorAll('.metrica-clic, .ir-btn, .flj-etapa--ir')).toHaveLength(0);
    });

    it('los números del reporte no abren ninguna lista', () => {
        const irA = vi.fn();
        pintar({ irA });

        // Ni el ojo de los tiles ni las barras de Cualificación y Conversión: solo bajan al panel.
        expect(screen.queryAllByRole('button', { name: 'Ver los registros' })).toHaveLength(0);
        expect(document.querySelectorAll('#p-cualificacion .ir-btn, #p-conversion .ir-btn')).toHaveLength(0);
    });
});

describe('Analizar · los datos de la conversación salen del reporte', () => {
    it('los tiles son Entrantes · Cualificación · Apertura · Agendas · Bienvenidas', () => {
        pintar();

        const tiles = [...document.querySelectorAll('.ds-tiles .kpi')];
        expect(tiles.map(t => t.querySelector('.t-eyebrow').textContent))
            .toEqual(['Entrantes', 'Cualificación', 'Apertura', 'Agendas', 'Bienvenidas']);
        expect(within(tiles[1]).getByText('72 de 90')).toBeInTheDocument();
        expect(screen.queryByText(/Tasa de respuesta/)).toBeNull();
        expect(screen.queryByText(/Cuadra con el sistema/)).toBeNull();
        expect(screen.queryByText(/Tenacidad/)).toBeNull();
    });

    it('lo de después de la agenda va en recuadros, con la comisión del mes', () => {
        pintar();

        const despues = document.getElementById('p-despues');
        ['Agendas', 'Canceladas', 'Reagendadas', 'No show', 'Show up', 'Ventas', 'Comisión del mes']
            .forEach(r => expect(within(despues).getByText(r)).toBeInTheDocument());
        expect(within(despues).getByText('$80')).toBeInTheDocument();
        expect(within(despues).getByText('8% de $1,000 netos')).toBeInTheDocument();
    });

    it('cada follow-up dice qué parte respondió, y «—» si el reporte no lo trae', () => {
        const { unmount } = pintar();
        const sinDato = document.querySelectorAll('.ds-fu-resp');
        expect([...sinDato].map(e => e.textContent)).toEqual(['—', '—', '—', '—']);
        unmount();

        pintar({ opciones: { respondidos: { entrantes: 10, dolor: 6, oferta: 3, link: 1 } } });
        expect([...document.querySelectorAll('.ds-fu-resp')].map(e => e.textContent))
            .toEqual(['25%', '50%', '50%', '25%']);
    });
});

describe('Analizar · General · Anuncios · Inbound', () => {
    it('una pestaña de canal cambia lo que el reporte separa por canal', () => {
        pintar({ canal: 'anuncios' });

        const tiles = [...document.querySelectorAll('.ds-tiles .kpi')];
        expect(within(tiles[0]).getByText('60')).toBeInTheDocument();
        expect(within(tiles[1]).getByText('48 de 60')).toBeInTheDocument();
        // El delta es el del canal, no el de General.
        expect(within(tiles[0]).getByText(/4%/)).toBeInTheDocument();
        // El link es un total: en un canal, «sin separar por canal».
        expect(screen.getByText('sin separar por canal')).toBeInTheDocument();
        // Las bienvenidas no se separan por canal y lo dice su tooltip.
        expect(screen.getByRole('note', { name: /^Bienvenidas: .*sin separar por canal\.$/ })).toBeInTheDocument();
        expect(document.querySelector('.ds-canal[data-activo]')).toHaveTextContent('Anuncios');
    });

    it('las pestañas avisan el canal elegido; General lo suelta', () => {
        const onCanal = vi.fn();
        pintar({ canal: 'anuncios', onCanal });

        const vistas = screen.getByRole('tablist', { name: 'Canal' });
        expect(within(vistas).getByRole('tab', { name: 'Anuncios' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(within(vistas).getByRole('tab', { name: 'Inbound' }));
        fireEvent.click(within(vistas).getByRole('tab', { name: 'General' }));

        expect(onCanal.mock.calls).toEqual([['inbound'], [null]]);
    });
});

describe('Analizar · poco texto', () => {
    it('todo tile y todo panel tiene su tooltip, de una oración de 15 palabras como mucho', () => {
        pintar();

        const tips = screen.getAllByRole('note').map(n => n.getAttribute('aria-label'));
        const largos = tips.map(t => t.slice(t.indexOf(': ') + 2))
            .filter(t => t.split(/\s+/).length > 15 || /\.\s+\S/.test(t));
        expect(largos).toEqual([]);

        // Cada tile y cada panel del tablero.
        const conTip = (el) => !!el.querySelector('[role=note]');
        expect([...document.querySelectorAll('.ds-tiles .kpi')].every(conTip)).toBe(true);
        expect([...document.querySelectorAll('.panel')].every(conTip)).toBe(true);
        expect([...document.querySelectorAll('.ds-caja')].every(conTip)).toBe(true);
    });
});
