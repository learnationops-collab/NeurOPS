import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Se prueba a través del cascarón y no de la cabecera suelta: lo que importa es el recorrido
// entero —lápiz, campos, PATCH, recarga y aviso—, que es lo que el usuario no tenía.
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    },
}));

import api from '../../services/api';
import FichaLeadModal from './FichaLeadModal';
import { fichaConDeuda, fichaPrecall, fichaSoloLectura } from './__fixtures__/ficha';

const abrir = async (ficha, props = {}) => {
    api.get.mockResolvedValue({ data: ficha });
    ['patch', 'post', 'put', 'delete'].forEach(m => api[m].mockResolvedValue({ data: { ok: true } }));
    const onCerrar = props.onCerrar || vi.fn();
    render(<FichaLeadModal appointmentId={9012} {...props} onCerrar={onCerrar} />);
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toBeInTheDocument());
    return { onCerrar };
};

const lapiz = () => screen.queryByRole('button', { name: 'Editar los datos del lead' });

beforeEach(() => { vi.clearAllMocks(); });

describe('el lápiz', () => {
    it('aparece sin que la pantalla que abre la ficha pase nada: lo decide el permiso', async () => {
        // Es el caso del dashboard comercial, que nunca pasó `onEditar`.
        await abrir(fichaPrecall);
        expect(lapiz()).toBeInTheDocument();
    });

    it('no aparece para quien no puede corregir los datos', async () => {
        await abrir({ ...fichaPrecall, permisos: { ...fichaPrecall.permisos, editar_datos: false } });
        expect(lapiz()).not.toBeInTheDocument();
    });

    it('en solo lectura tampoco', async () => {
        await abrir(fichaSoloLectura);
        expect(lapiz()).not.toBeInTheDocument();
    });
});

describe('la franja en modo edición', () => {
    it('trae los datos guardados en campos, en el lugar de la franja', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaConDeuda);
        await usuario.click(lapiz());

        expect(screen.getByLabelText('Nombre del lead')).toHaveValue('Kevin Encalada');
        expect(screen.getByLabelText('Teléfono')).toHaveValue('+593 99 515 7254');
        expect(screen.getByLabelText('Correo')).toHaveValue('kevin@example.com');
        expect(screen.getByLabelText('Instagram')).toHaveValue('kevin.enc');
        // Un cliente que ya compró muestra el programa en la franja, pero el examen se sigue
        // pudiendo corregir.
        expect(screen.getByLabelText('Examen')).toHaveValue('MIR / ENARM');
        expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });

    it('Enter guarda solo lo que cambió, recarga la ficha y deja el aviso', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(lapiz());

        const telefono = screen.getByLabelText('Teléfono');
        await usuario.clear(telefono);
        await usuario.type(telefono, '+593 99 000 1111');
        const instagram = screen.getByLabelText('Instagram');
        await usuario.clear(instagram);
        await usuario.type(instagram, 'kevin.nuevo{Enter}');

        expect(api.patch).toHaveBeenCalledWith('/ficha/9012/datos',
            { telefono: '+593 99 000 1111', instagram: 'kevin.nuevo' });
        await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('Datos del lead corregidos.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kevin Encalada');
        // El foco vuelve al lápiz, no se pierde en un campo que ya no existe.
        await waitFor(() => expect(lapiz()).toHaveFocus());
    });

    it('el botón Guardar también guarda', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(lapiz());
        await usuario.clear(screen.getByLabelText('Nombre del lead'));
        await usuario.type(screen.getByLabelText('Nombre del lead'), 'Kevin Encalada Mora');
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(api.patch).toHaveBeenCalledWith('/ficha/9012/datos', { nombre: 'Kevin Encalada Mora' });
    });

    it('guardar sin tocar nada cierra sin pedirle nada al backend', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        await usuario.click(lapiz());
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(api.patch).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('Escape cancela la edición sin cerrar la ficha', async () => {
        const usuario = userEvent.setup();
        const { onCerrar } = await abrir(fichaPrecall);
        await usuario.click(lapiz());
        await usuario.type(screen.getByLabelText('Correo'), 'algo');
        await usuario.keyboard('{Escape}');

        expect(onCerrar).not.toHaveBeenCalled();
        expect(api.patch).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Kevin Encalada');
        // Con la edición ya cerrada, Escape vuelve a ser cerrar la ficha.
        await usuario.keyboard('{Escape}');
        expect(onCerrar).toHaveBeenCalledTimes(1);
    });

    it('el error del backend queda al lado del campo que lo causó y el editor sigue abierto', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaPrecall);
        api.patch.mockRejectedValueOnce({ response: { status: 409, data: {
            message: 'El correo «maria@x.com» ya es de otro cliente: Maria Lopez (#77).',
            campo: 'email', choque: { id: 77, nombre: 'Maria Lopez' },
        } } });
        await usuario.click(lapiz());
        const correo = screen.getByLabelText('Correo');
        await usuario.clear(correo);
        await usuario.type(correo, 'maria@x.com{Enter}');

        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('Maria Lopez');
        expect(correo).toHaveAttribute('aria-invalid', 'true');
        expect(correo).toHaveValue('maria@x.com');
        // Corregir el campo borra el error de ese campo.
        await usuario.type(correo, 'x');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
