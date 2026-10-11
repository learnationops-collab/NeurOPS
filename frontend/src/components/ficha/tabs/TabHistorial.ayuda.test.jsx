import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';

/**
 * El tooltip de «Lead perdido» y de «Archivada sin reporte» en las agendas de la ficha (10/10/2026):
 * en el chip de quien solo mira (el setter, por ejemplo) y en el desplegable de quien corrige.
 */

const ARCHIVADA = 'Nadie la reportó en 30 días; el sistema la archivó.';

const AGENDA = {
    id: 71, fecha: '2026-08-02T21:30:00', detalle: 'vsl · Jean Carlo',
    chip: { label: 'Archivada sin reporte', tone: 'idle', ayuda: ARCHIVADA },
    pre_call: 'sin_confirmar', post_call: 'archivada_sin_reporte', closer: 'Jean Carlo', closer_id: 7,
    fuente: 'vsl',
};

// Con la forma que manda el backend (`comercial_service.POST_CALL`).
const VOCABULARIO = {
    ...fichaPrecall.vocabulario,
    pre_call: [{ key: 'sin_confirmar', label: 'Sin confirmar' }],
    post_call: [
        { key: 'pendiente', label: 'Pendiente', editable: true },
        { key: 'archivada_sin_reporte', label: 'Archivada sin reporte', editable: false, ayuda: ARCHIVADA },
        { key: 'lead_perdido', label: 'Lead perdido', editable: false, ayuda: 'El closer lo descartó.' },
    ],
    fuentes: [],
    tipos_seguimiento: [],
};

const abrir = async (permisos = {}) => {
    const usuario = userEvent.setup();
    const ficha = {
        ...fichaPrecall,
        historial: { ...fichaPrecall.historial, agendas: [AGENDA] },
        vocabulario: VOCABULARIO,
        permisos: { ...fichaPrecall.permisos, ...permisos },
    };
    render(<TabHistorial ficha={ficha} onAccion={vi.fn().mockResolvedValue({})} />);
    await usuario.click(screen.getByRole('button', { name: /Agendas/ }));
};

describe('el tooltip del estado de una agenda en la ficha', () => {
    it('quien solo mira lo ve en el chip', async () => {
        await abrir({ reportar: false, reasignar: false });

        expect(screen.getByText('Archivada sin reporte')).toHaveAttribute('title', ARCHIVADA);
    });

    it('quien corrige lo ve en el desplegable y en cada opción que lo tiene', async () => {
        await abrir();

        const post = screen.getByLabelText(/Post call de la agenda/);
        expect(post).toHaveValue('archivada_sin_reporte');
        expect(post).toHaveAttribute('title', ARCHIVADA);
        expect(screen.getByRole('option', { name: 'Lead perdido' }))
            .toHaveAttribute('title', 'El closer lo descartó.');
        expect(screen.getByRole('option', { name: 'Pendiente' })).not.toHaveAttribute('title');
    });
});
