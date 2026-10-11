import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TarjetaAgenda from './TarjetaAgenda';

/**
 * El chip de estado de una tarjeta de «Mis agendas» lleva el tooltip que manda el backend en los
 * estados que hay que explicar (10/10/2026): «Lead perdido» y «Archivada sin reporte».
 */

const agenda = (estado) => ({
    id: 1, client_id: 10, cliente: 'Fede Luz', instagram: 'fedeluz', telefono: '', reunion: '2026-08-12T14:00:00',
    creada: '2026-08-08T14:00:00', closer: 'Marlon', canal: null, sugerido: null, estado,
});

describe('TarjetaAgenda · el tooltip del estado', () => {
    it('la archivada explica que la archivó el sistema', () => {
        const ayuda = 'Nadie la reportó en 30 días; el sistema la archivó.';
        render(<TarjetaAgenda agenda={agenda({ key: 'archivada_sin_reporte', label: 'Archivada sin reporte',
            tone: 'idle', ayuda })} anuncios={[]} onAsignar={vi.fn()} />);

        expect(screen.getByText('Archivada sin reporte')).toHaveAttribute('title', ayuda);
    });

    it('un estado sin ayuda no dibuja tooltip', () => {
        render(<TarjetaAgenda agenda={agenda({ key: 'confirmada', label: 'Confirmada', tone: 'info' })}
            anuncios={[]} onAsignar={vi.fn()} />);

        expect(screen.getByText('Confirmada')).not.toHaveAttribute('title');
    });
});
