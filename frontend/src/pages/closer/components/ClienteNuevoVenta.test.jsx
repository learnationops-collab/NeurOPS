import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../services/api';
import ClienteNuevoVenta, { repartirBusqueda } from './ClienteNuevoVenta';

beforeEach(() => { vi.clearAllMocks(); });

describe('repartirBusqueda', () => {
  it('pone lo que se buscó en el campo que le corresponde', () => {
    expect(repartirBusqueda('bruno@mail.com')).toEqual({ email: 'bruno@mail.com' });
    expect(repartirBusqueda('@bruno.diaz')).toEqual({ instagram: 'bruno.diaz' });
    expect(repartirBusqueda('+54 9 11 5555 1234')).toEqual({ telefono: '+54 9 11 5555 1234' });
    expect(repartirBusqueda('  Bruno Díaz ')).toEqual({ nombre: 'Bruno Díaz' });
    expect(repartirBusqueda('')).toEqual({});
  });
});

describe('ClienteNuevoVenta', () => {
  it('arranca con lo que se buscó y no deja abrir la venta sin nombre y email válido', async () => {
    const user = userEvent.setup();
    render(<ClienteNuevoVenta busqueda="Bruno Díaz" onAbierto={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.getByLabelText(/Nombre y apellido/)).toHaveValue('Bruno Díaz');
    const abrir = screen.getByRole('button', { name: 'Abrir la venta' });
    expect(abrir).toBeDisabled();
    await user.type(screen.getByLabelText(/Email/), 'bruno.mail.com');
    expect(abrir).toBeDisabled();
    await user.clear(screen.getByLabelText(/Email/));
    await user.type(screen.getByLabelText(/Email/), 'bruno@mail.com');
    expect(abrir).toBeEnabled();
  });

  it('crea al cliente y avisa con la agenda donde abrir la venta', async () => {
    const user = userEvent.setup();
    const respuesta = { appointment_id: 88, client_id: 7, nombre: 'Bruno Díaz', nuevo: true };
    api.post.mockResolvedValue({ data: respuesta });
    const onAbierto = vi.fn();
    render(<ClienteNuevoVenta busqueda="bruno@mail.com" onAbierto={onAbierto} onCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Nombre y apellido/), 'Bruno Díaz');
    await user.type(screen.getByLabelText('Instagram'), '@bruno.diaz');
    await user.click(screen.getByRole('button', { name: 'Abrir la venta' }));

    expect(api.post).toHaveBeenCalledWith('/ficha/cliente-nuevo/agenda-de-venta', {
      nombre: 'Bruno Díaz', email: 'bruno@mail.com', instagram: '@bruno.diaz', telefono: '',
    });
    expect(onAbierto).toHaveBeenCalledWith(respuesta);
  });

  it('un error del backend queda a la vista, marcado en su campo', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({ response: { data: { message: 'Falta un email válido.', campo: 'email' } } });
    const onAbierto = vi.fn();
    render(<ClienteNuevoVenta busqueda="bruno@mail.com" onAbierto={onAbierto} onCancelar={vi.fn()} />);
    await user.type(screen.getByLabelText(/Nombre y apellido/), 'Bruno');
    await user.click(screen.getByRole('button', { name: 'Abrir la venta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falta un email válido.');
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(onAbierto).not.toHaveBeenCalled();
  });
});
