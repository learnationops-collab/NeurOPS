import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';

// `start_time` viaja en UTC y sin Z, como lo manda `isoformat()`. Las expectativas se arman con la
// misma cuenta en la zona del proceso, para que el test no dependa del huso de la máquina.
const HORA_UTC = '2026-10-02T21:30:00';
const enLocal = (iso) => {
    const d = new Date(`${iso}Z`);
    const dia = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dia} · ${d.toTimeString().slice(0, 5)}`;
};

const AGENDA = {
    id: 71, fecha: HORA_UTC, detalle: 'vsl · Jean Carlo', chip: { label: 'Próxima', tone: 'info' },
    pre_call: 'sin_confirmar', post_call: 'pendiente', closer: 'Jean Carlo', closer_id: 7,
    fuente: 'vsl',
};

// Los estados con la forma que manda el backend (`comercial_service.PRE_CALL`/`POST_CALL`).
const VOCABULARIO = {
    ...fichaPrecall.vocabulario,
    pre_call: [{ key: 'confirmada', label: 'Confirmada' }, { key: 'sin_confirmar', label: 'Sin confirmar' }],
    post_call: [
        { key: 'pendiente', label: 'Pendiente', editable: true },
        { key: 'no_show', label: 'No show', editable: true },
        { key: 'venta', label: 'Venta', editable: false },
    ],
};

const ficha = (agendas = [AGENDA], extra = {}) => ({
    ...fichaPrecall,
    historial: { ...fichaPrecall.historial, agendas },
    vocabulario: VOCABULARIO,
    ...extra,
});

const abrirAgendas = async (usuario, f = ficha(), onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /Agendas/ }));
    return onAccion;
};

describe('la hora de las agendas', () => {
    it('se muestra en el reloj de quien mira, no en UTC', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario);

        // La fila y el resumen de la sección dicen la misma hora local.
        expect(screen.getAllByText(enLocal(HORA_UTC)).length).toBeGreaterThan(0);
        expect(screen.getByText(new RegExp(`próxima ${enLocal(HORA_UTC)}`))).toBeInTheDocument();
    });

    it('«Agendar otra llamada» manda un instante UTC, no la hora local cruda', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(screen.getByRole('button', { name: 'Agendar otra llamada' }));
        const campo = screen.getByLabelText('Fecha y hora de la llamada');
        await usuario.clear(campo);
        await usuario.type(campo, '2026-12-15T10:00');
        await usuario.click(screen.getByRole('button', { name: 'Agendar' }));

        expect(onAccion).toHaveBeenCalledWith('crear_agenda', {
            fecha: new Date('2026-12-15T10:00:00').toISOString(), closer_id: 7,
        });
    });
});
