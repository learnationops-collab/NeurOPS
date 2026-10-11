import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RepartoEstados from './RepartoEstados';

/**
 * El panel Estados de Analizar lleva el tooltip de «Lead perdido» y de «Archivada sin reporte»
 * (10/10/2026) en su fila de la tabla y en su arco de la dona.
 */

const ARCHIVADA = 'Nadie la reportó en 30 días; el sistema la archivó.';
const ESTADOS = [
    { key: 'sin_reporte', label: 'Sin reporte', tone: 'warning', n: 5, filtro: 'Sin reporte', grupo: 'sin_resultado' },
    { key: 'archivada_sin_reporte', label: 'Archivada sin reporte', tone: 'idle', n: 3,
        filtro: 'Archivada sin reporte', grupo: 'sin_resultado', ayuda: ARCHIVADA },
    { key: 'lead_perdido', label: 'Lead perdido', tone: 'error', n: 2, filtro: 'Lead perdido',
        grupo: 'sin_resultado', ayuda: 'El closer lo descartó.' },
];

describe('RepartoEstados · el tooltip de los estados que hay que explicar', () => {
    it('en la tabla, sobre la fila', () => {
        render(<RepartoEstados estados={ESTADOS} vista="tabla" irA={vi.fn()} />);

        expect(screen.getByRole('button', { name: /^Archivada sin reporte:/ })).toHaveAttribute('title', ARCHIVADA);
        expect(screen.getByRole('button', { name: /^Lead perdido:/ }))
            .toHaveAttribute('title', 'El closer lo descartó.');
        expect(screen.getByRole('button', { name: /^Sin reporte:/ })).not.toHaveAttribute('title');
    });

    it('en la dona, en el título del arco', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" />);
        const titulos = [...container.querySelectorAll('circle.est-seg title')].map(t => t.textContent);

        const archivada = titulos.find(t => t.startsWith('Archivada sin reporte: 3 agendas'));
        expect(archivada.endsWith(`%. ${ARCHIVADA}`)).toBe(true);
        expect(titulos.find(t => t.startsWith('Sin reporte: 5 agendas')).endsWith('%')).toBe(true);
    });
});
