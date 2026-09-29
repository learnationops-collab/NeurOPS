import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EsqueletoKanban from './EsqueletoKanban';
import { escalonDe } from '../../../components/huesos/Huesos';

/**
 * El esqueleto del kanban sólo sirve si tiene la forma del kanban real: mismas clases de grilla y
 * de columna, mismos títulos, y el escalón en el mismo orden que las tarjetas que lo reemplazan
 * (renglón × columnas + columna, ver `renderKanbanCard` en CloserWorkflowPage).
 *
 * jsdom no hace layout, así que acá se verifica el contrato —clases, títulos, orden de entrada,
 * qué tarjeta lleva botón y cuál sello—; las medidas en píxeles salen de `index.css`.
 */

const CONFIRMAR = [
    { clase: 'k1-v6', titulo: 'Por confirmar', subgrupo: true },
    { clase: 'k3-v6', titulo: 'Confirmado', hecha: true },
];

const LLAMADAS = [
    { clase: 'k1-v6', titulo: 'Atrasadas' },
    { clase: 'k2-v6', titulo: 'Hoy' },
    { clase: 'k3-v6', titulo: 'Reportadas', hecha: true },
];

const tablero = (columnas) => render(<EsqueletoKanban rotulo="Cargando…" columnas={columnas} />).container;

/** El último hueso de cada tarjeta es el botón (36,25 px) o el sello de hecha (23,5 px). */
const piesDe = (columna) => [...columna.querySelectorAll('.kcard-v6')]
    .map(tarjeta => [...tarjeta.querySelectorAll('.hueso')].at(-1).style.height);

describe('EsqueletoKanban', () => {
    it('se anuncia como carga con su rótulo, y el resto es decorativo', () => {
        render(<EsqueletoKanban rotulo="Cargando llamadas…" columnas={LLAMADAS} />);
        const estado = screen.getByRole('status', { name: 'Cargando llamadas…' });
        expect(estado.getAttribute('aria-busy')).toBe('true');
        estado.querySelectorAll('.kcol-v6').forEach(col => expect(col.getAttribute('aria-hidden')).toBe('true'));
    });

    it('usa la grilla de dos columnas sólo cuando son dos, como el kanban real', () => {
        expect(tablero(CONFIRMAR).querySelector('.kb-v6').classList.contains('kb2-v6')).toBe(true);
        expect(tablero(LLAMADAS).querySelector('.kb-v6').classList.contains('kb2-v6')).toBe(false);
    });

    it('dibuja cada columna con su clase de color y su título escrito', () => {
        const columnas = [...tablero(LLAMADAS).querySelectorAll('.kcol-v6')];
        expect(columnas.map(c => c.className)).toEqual(['kcol-v6 k1-v6', 'kcol-v6 k2-v6', 'kcol-v6 k3-v6']);
        expect(columnas.map(c => c.querySelector('.kch-v6 b').textContent)).toEqual(['Atrasadas', 'Hoy', 'Reportadas']);
    });

    it('sólo la columna con subgrupo abre con la línea de subgrupo', () => {
        const [porConfirmar, confirmado] = tablero(CONFIRMAR).querySelectorAll('.kcol-v6');
        expect(porConfirmar.querySelector('.kbody-v6 > .ksub-v6')).not.toBeNull();
        expect(confirmado.querySelector('.ksub-v6')).toBeNull();
    });

    it('las tarjetas pendientes cierran con el botón y las hechas con el sello', () => {
        const [atrasadas, hoy, reportadas] = tablero(LLAMADAS).querySelectorAll('.kcol-v6');
        expect(piesDe(atrasadas)).toEqual(['36.25px', '36.25px']);
        expect(piesDe(hoy)).toEqual(['36.25px', '36.25px']);
        expect(piesDe(reportadas)).toEqual(['23.5px', '23.5px']);
    });

    it('entra renglón por renglón: primero la primera tarjeta de cada columna', () => {
        const columnas = [...tablero(LLAMADAS).querySelectorAll('.kcol-v6')];
        // El retraso de cada tarjeta, leído del primer hueso (el de la cuenta regresiva).
        const retrasos = columnas.map(col => [...col.querySelectorAll('.kcard-v6')]
            .map(t => t.querySelector('.hueso').style.getPropertyValue('--d')));
        expect(retrasos).toEqual([
            [`${escalonDe(0)}ms`, `${escalonDe(3)}ms`],
            [`${escalonDe(1)}ms`, `${escalonDe(4)}ms`],
            [`${escalonDe(2)}ms`, `${escalonDe(5)}ms`],
        ]);
    });
});
