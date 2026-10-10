import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';

// Pedido de Kerwin (09/10/2026): «Agregar objeción» en el historial, para las llamadas que no
// cerraron y se reportaron antes de que la objeción fuera obligatoria. El backend manda en cada
// agenda su objeción vigente (`objecion`) y si le corresponde una (`admite_objecion`).

const AGENDA = {
    id: 71, fecha: '2026-09-12T21:30:00', detalle: 'vsl · Jean Carlo', chip: { label: 'Asistió', tone: 'success' },
    pre_call: 'confirmada', post_call: 'asistio', closer: 'Jean Carlo', closer_id: 7, fuente: 'vsl',
    objecion: null, admite_objecion: true,
};
const CON_OBJECION = {
    ...AGENDA, id: 72, fecha: '2026-08-01T15:00:00',
    objecion: { texto: 'Lo tiene que hablar con la pareja', autor: 'Jean Carlo', fecha: '2026-08-01T16:10:00' },
};
const NO_SHOW = {
    ...AGENDA, id: 73, chip: { label: 'No show', tone: 'error' }, post_call: 'no_show', admite_objecion: false,
};

const ficha = (agendas, permisos = {}) => ({
    ...fichaPrecall,
    historial: { ...fichaPrecall.historial, agendas },
    permisos: { ...fichaPrecall.permisos, reportar: true, ...permisos },
});

const abrir = async (usuario, f, onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /Agendas/ }));
    return onAccion;
};

describe('la objeción de una llamada que no cerró, en el historial', () => {
    it('el resumen de «Agendas» cuenta las que no cerraron y no dicen por qué', () => {
        render(<TabHistorial ficha={ficha([AGENDA, CON_OBJECION, NO_SHOW])} onAccion={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Agendas/ })).toHaveTextContent('1 sin objeción');
    });

    it('solo la llamada que no cerró ofrece «Agregar objeción»', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, ficha([AGENDA, NO_SHOW]));
        expect(screen.getAllByRole('button', { name: /Agregar la objeción/ })).toHaveLength(1);
        expect(screen.getByText('Asistió y no cerró: falta la objeción.')).toBeInTheDocument();
    });

    it('agregarla pide el mínimo y la manda a ESA agenda, recortada', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, ficha([CON_OBJECION, AGENDA]));
        await usuario.click(screen.getByRole('button', { name: /Agregar la objeción/ }));

        const editor = screen.getByRole('group', { name: /Objeción de la agenda/ });
        const campo = within(editor).getByLabelText('¿Por qué no cerró? ¿Cuál es la objeción?');
        const guardar = within(editor).getByRole('button', { name: 'Guardar objeción' });
        expect(guardar).toBeDisabled();
        await usuario.type(campo, 'Es caro');
        expect(within(editor).getByText('Mínimo 10 caracteres · llevás 7')).toBeInTheDocument();
        expect(guardar).toBeDisabled();
        await usuario.type(campo, ' y no quiere cuotas  ');
        await usuario.click(guardar);

        expect(onAccion).toHaveBeenCalledWith('guardar_objecion', { texto: 'Es caro y no quiere cuotas' }, 71);
        expect(screen.queryByRole('group', { name: /Objeción de la agenda/ })).toBeNull();
    });

    it('la que ya tiene se lee entera, con quién y cuándo, y «Reemplazar» la abre para corregirla', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, ficha([CON_OBJECION]));
        expect(screen.getByText('Lo tiene que hablar con la pareja')).toBeInTheDocument();
        expect(screen.getByText(/^Jean Carlo · /)).toBeInTheDocument();

        await usuario.click(screen.getByRole('button', { name: /Reemplazar la objeción/ }));
        const campo = screen.getByLabelText('¿Por qué no cerró? ¿Cuál es la objeción?');
        expect(campo).toHaveValue('Lo tiene que hablar con la pareja');
        await usuario.clear(campo);
        await usuario.type(campo, 'Quiere empezar el año que viene');
        await usuario.click(screen.getByRole('button', { name: 'Guardar objeción' }));

        expect(onAccion).toHaveBeenCalledWith('guardar_objecion', { texto: 'Quiere empezar el año que viene' }, 72);
    });

    it('si el backend la rechaza, el motivo queda al lado del botón y el texto no se pierde', async () => {
        const usuario = userEvent.setup();
        const rechazo = { response: { data: { message: 'Solo lleva objeción una llamada a la que el lead asistió' } } };
        await abrir(usuario, ficha([AGENDA]), vi.fn().mockRejectedValue(rechazo));
        await usuario.click(screen.getByRole('button', { name: /Agregar la objeción/ }));
        await usuario.type(screen.getByLabelText('¿Por qué no cerró? ¿Cuál es la objeción?'), 'Lo tiene que pensar bien');
        await usuario.click(screen.getByRole('button', { name: 'Guardar objeción' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Solo lleva objeción una llamada');
        expect(screen.getByLabelText('¿Por qué no cerró? ¿Cuál es la objeción?')).toHaveValue('Lo tiene que pensar bien');
    });

    it('Escape cierra el editor y devuelve el foco al botón', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, ficha([AGENDA]));
        await usuario.click(screen.getByRole('button', { name: /Agregar la objeción/ }));
        await usuario.keyboard('{Escape}');

        expect(screen.queryByRole('group', { name: /Objeción de la agenda/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Agregar la objeción/ })).toHaveFocus();
    });

    it('sin permiso de reportar se lee la objeción pero no se agrega ni se reemplaza', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, ficha([AGENDA, CON_OBJECION], { reportar: false }));
        expect(screen.getByText('Lo tiene que hablar con la pareja')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /objeción/i })).toBeNull();
        expect(screen.queryByText('Asistió y no cerró: falta la objeción.')).toBeNull();
        expect(screen.getByRole('button', { name: /Agendas/ })).not.toHaveTextContent('sin objeción');
    });

    it('en el registro de eventos una objeción lleva su rótulo', async () => {
        const usuario = userEvent.setup();
        const f = ficha([AGENDA]);
        f.historial = { ...f.historial, eventos: [
            { id: 9, fecha: '2026-09-12T22:00:00', tipo: 'objecion', detalle: 'Lo tiene que pensar bien', autor: 'Jean Carlo' },
        ] };
        render(<TabHistorial ficha={f} onAccion={vi.fn()} />);
        await usuario.click(screen.getByRole('button', { name: /Registro de eventos/ }));
        const fila = screen.getByText('Lo tiene que pensar bien').closest('.fi-sec-fila');
        expect(within(fila).getByText('Objeción')).toBeInTheDocument();
    });
});
