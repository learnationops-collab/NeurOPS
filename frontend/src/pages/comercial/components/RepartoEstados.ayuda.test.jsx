import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RepartoEstados, { agrupar } from './RepartoEstados';

/**
 * El panel Estados de Analizar lleva el tooltip de «Lead perdido» y de «Archivada sin reporte»
 * (10/10/2026) en su fila de la tabla y en su arco de la dona.
 */

const ARCHIVADA = 'Nadie la reportó en 30 días; el sistema la archivó.';
const ESTADOS = [
    { key: 'sin_reporte', label: 'Sin reporte', tone: 'warning', n: 5, filtro: 'Sin reporte', grupo: 'sin_reporte' },
    { key: 'archivada_sin_reporte', label: 'Archivada sin reporte', tone: 'idle', n: 3,
        filtro: 'Archivada sin reporte', grupo: 'descartadas', ayuda: ARCHIVADA },
    { key: 'lead_perdido', label: 'Lead perdido', tone: 'error', n: 2, filtro: 'Lead perdido',
        grupo: 'descartadas', ayuda: 'El closer lo descartó.' },
];

describe('RepartoEstados · el tooltip de los estados que hay que explicar', () => {
    it('en la tabla, sobre la fila', () => {
        render(<RepartoEstados estados={ESTADOS} vista="tabla" irA={vi.fn()} />);

        expect(screen.getByRole('button', { name: /^Archivada sin reporte:/ })).toHaveAttribute('title', ARCHIVADA);
        expect(screen.getByRole('button', { name: /^Lead perdido:/ }))
            .toHaveAttribute('title', 'El closer lo descartó.');
        expect(screen.getByRole('button', { name: /^Sin reporte:/ })).not.toHaveAttribute('title');
    });

    it('en el gráfico: el arco de lo que cuenta en el show up y la cifra de lo que queda fuera', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" irA={vi.fn()} />);
        const titulos = [...container.querySelectorAll('circle.est-seg title')].map(t => t.textContent);

        // La dona reparte solo la base del show up (ADR-W144): la archivada no tiene arco.
        expect(titulos).toEqual(['Sin reporte: 5 agendas, 100.0%']);
        expect(screen.getByRole('button', { name: /^Archivada sin reporte: 3 agendas, fuera del show up/ }))
            .toHaveAttribute('title', ARCHIVADA);
    });

    it('el centro dice el show up sobre la misma base que la tarjeta: también las sin reporte', () => {
        render(<RepartoEstados vista="grafico" estados={[
            { key: 'asistio', label: 'Asistió', tone: 'success', n: 6, filtro: 'Asistió', grupo: 'show_up' },
            { key: 'no_show', label: 'No show', tone: 'error', n: 2, filtro: 'No show', grupo: 'no_show' },
            ...ESTADOS,
        ]} />);

        // 6 de 13 (6 + 2 + 5 sin reporte); las 5 descartadas no entran.
        expect(screen.getByText('6 de 13')).toBeInTheDocument();
        expect(agrupar([{ key: 'asistio', n: 6, grupo: 'show_up' }, { key: 'no_show', n: 2, grupo: 'no_show' }, ...ESTADOS])
            .filter(g => !g.fuera).reduce((a, g) => a + g.pct, 0)).toBeCloseTo(100, 5);
    });
});
