import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';

// `start_time` viaja en UTC y sin Z, como lo manda `isoformat()`. Las expectativas se arman con la
// misma cuenta en la zona del proceso, para que el test no dependa del huso de la máquina.
const HORA_UTC = '2026-10-02T21:30:00';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const enLocal = (iso) => {
    const d = new Date(`${iso}Z`);
    const hora = [d.getHours(), d.getMinutes()].map(n => String(n).padStart(2, '0')).join(':');
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hora}`;
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
    // `ficha_vocabulario.fuentes_disponibles()`: el catálogo del Tablero de Agendas, en dos grupos.
    fuentes: [
        { titulo: 'Embudos', tono: 'info', opciones: [
            { clave: 'workshop', label: 'Workshop en vivo' },
            { clave: 'vsl', label: 'VSL' },
        ] },
        { titulo: 'Setters', tono: 'success', opciones: [{ clave: 'Paula', label: 'Paula' }] },
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

// Pedido del 29/09/2026: la fecha, la hora, la fuente (y el closer) de cada agenda se corrigen en
// la fila, con el lápiz.
describe('corregir una agenda en la fila', () => {
    const lapiz = () => screen.getByRole('button', { name: /Corregir fecha, fuente y closer/ });
    const editor = () => screen.getByRole('group', { name: /Corregir la agenda/ });

    it('el lápiz abre el editor con lo que la agenda tiene hoy, en hora local', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario);
        await usuario.click(lapiz());

        const d = new Date(`${HORA_UTC}Z`);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
            + `${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:`
            + `${String(d.getMinutes()).padStart(2, '0')}`;
        expect(within(editor()).getByLabelText('Fecha y hora')).toHaveValue(local);
        expect(within(editor()).getByLabelText('Fuente de la agenda')).toHaveValue('vsl');
        expect(within(editor()).getByLabelText('Closer de la agenda')).toHaveValue('7');
        // Los desplegables de estado siguen en la fila.
        expect(screen.getByLabelText(/Pre call de la agenda/)).toBeInTheDocument();
        // Sin cambios no hay nada que guardar.
        expect(within(editor()).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('guarda solo lo que cambió, con la hora como instante UTC y apuntado a ESA agenda', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(lapiz());
        const campo = within(editor()).getByLabelText('Fecha y hora');
        await usuario.clear(campo);
        await usuario.type(campo, '2026-10-03T09:15');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda',
            { fecha: new Date('2026-10-03T09:15:00').toISOString() }, 71);
        // Se cerró al guardar bien.
        expect(screen.queryByRole('group', { name: /Corregir la agenda/ })).not.toBeInTheDocument();
    });

    it('la fuente sale del catálogo y el closer de la lista de closers', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrirAgendas(usuario);
        await usuario.click(lapiz());
        await usuario.selectOptions(within(editor()).getByLabelText('Fuente de la agenda'), 'Paula');
        await usuario.selectOptions(within(editor()).getByLabelText('Closer de la agenda'), '8');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda', { fuente: 'Paula', closer_id: 8 }, 71);
    });

    it('una fuente vieja fuera del catálogo se muestra, y no viaja si no se toca', async () => {
        const usuario = userEvent.setup();
        const vieja = { ...AGENDA, fuente: 'Entrevista Diagnóstica Gratuita' };
        const onAccion = await abrirAgendas(usuario, ficha([vieja]));
        await usuario.click(lapiz());

        expect(within(editor()).getByLabelText('Fuente de la agenda'))
            .toHaveValue('Entrevista Diagnóstica Gratuita');
        expect(within(editor()).getByRole('option', { name: /fuera del catálogo/ })).toBeInTheDocument();
        await usuario.selectOptions(within(editor()).getByLabelText('Closer de la agenda'), '9');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('editar_agenda', { closer_id: 9 }, 71);
    });

    it('si el backend rechaza, el editor se queda abierto con lo elegido', async () => {
        const usuario = userEvent.setup();
        const onAccion = vi.fn().mockRejectedValue(new Error('Ese closer ya tiene otra llamada'));
        await abrirAgendas(usuario, ficha(), onAccion);
        await usuario.click(lapiz());
        await usuario.selectOptions(within(editor()).getByLabelText('Fuente de la agenda'), 'workshop');
        await usuario.click(within(editor()).getByRole('button', { name: 'Guardar cambios' }));

        expect(within(editor()).getByLabelText('Fuente de la agenda')).toHaveValue('workshop');
    });

    it('sin el permiso de reasignar no se ofrece cambiar el closer', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario, ficha([AGENDA], {
            permisos: { ...fichaPrecall.permisos, reasignar: false },
        }));
        await usuario.click(lapiz());

        expect(within(editor()).queryByLabelText('Closer de la agenda')).not.toBeInTheDocument();
        expect(within(editor()).getByLabelText('Fuente de la agenda')).toBeInTheDocument();
    });

    it('quien no puede reportar ve la agenda pero no el lápiz', async () => {
        const usuario = userEvent.setup();
        await abrirAgendas(usuario, ficha([AGENDA], {
            permisos: { ...fichaPrecall.permisos, reportar: false, reasignar: false },
        }));

        expect(screen.queryByRole('button', { name: /Corregir fecha, fuente y closer/ }))
            .not.toBeInTheDocument();
        expect(screen.getByText('VSL · Jean Carlo')).toBeInTheDocument();
    });
});
