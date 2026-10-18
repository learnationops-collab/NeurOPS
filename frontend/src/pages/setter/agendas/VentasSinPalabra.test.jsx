import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../../services/api';
import VentasSinPalabra from './VentasSinPalabra';

const ANUNCIOS = [{ id: 7, keyword: 'GUIA PERU', status: 'active' }];
const pago = (id, monto, palabra = null) => ({ id, fecha: '2026-10-02T00:00:00', tipo: 'AL - Cuota', programa: 'Ace Learners', monto, palabra_clave: palabra });
const DATOS = {
    pendientes: [
        { grupo: 'c1', client_id: 1, cliente: 'Ana Torres', instagram: 'ana.torres', total: 1000, primera: '2026-09-20', ultima: '2026-10-02',
          pagos: [pago(11, 300), pago(12, 700)], palabras: [] },
        { grupo: 'c2', client_id: 2, cliente: 'Beto Ruiz', instagram: null, total: 500, primera: '2026-10-01', ultima: '2026-10-01',
          pagos: [pago(21, 500)], palabras: [] },
    ],
    completadas: [{ grupo: 'c3', client_id: 3, cliente: 'Caro Paz', instagram: 'caro', total: 250, pagos: [pago(31, 250, 'APLICAR')], palabras: ['APLICAR'] }],
    resumen: { clientes: 2, monto: 1500 },
};

describe('Mis agendas › Ventas sin palabra clave', () => {
    beforeEach(() => {
        api.get.mockResolvedValue({ data: DATOS });
        api.post.mockResolvedValue({ data: { grupo: 'c1', instagram: 'ana.torres', pagos: 2, anuncio: { id: 7, keyword: 'GUIA PERU' } } });
    });

    it('muestra un cliente por tarjeta con sus pagos, y la palabra clave va a todos', async () => {
        const user = userEvent.setup();
        render(<VentasSinPalabra anuncios={ANUNCIOS} />);
        const ana = await screen.findByRole('listitem', { name: 'Ventas de Ana Torres' });
        expect(within(ana).getByText('2 pagos · $1,000')).toBeInTheDocument();
        expect(within(within(ana).getByRole('list', { name: 'Pagos de Ana Torres' })).getAllByText('Sin palabra clave')).toHaveLength(2);
        // Al que le falta el Instagram, el campo aparece abierto.
        expect(within(screen.getByRole('listitem', { name: 'Ventas de Beto Ruiz' })).getByText('Falta el Instagram')).toBeInTheDocument();
        expect(screen.getByText('$1,500 sin anuncio')).toBeInTheDocument();

        await user.type(within(ana).getByRole('combobox'), 'guia');
        await user.keyboard('{Enter}'); // como con las agendas: Enter elige y asigna

        expect(api.post).toHaveBeenCalledWith('/setter/palabras-clave/ventas', { grupo: 'c1', ad_id: 7 });
        await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Ventas de Ana Torres' })).not.toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: '2 clientes con palabra clave' }));
        expect(screen.getByText('GUIA PERU')).toBeInTheDocument();
    });

    it('una palabra clave equivocada se cambia desde la lista de las que ya tienen', async () => {
        const user = userEvent.setup();
        api.get.mockResolvedValue({ data: { ...DATOS, completadas: [{ ...DATOS.completadas[0], cambiable: true }] } });
        api.post.mockResolvedValue({ data: { grupo: 'c3', instagram: 'caro', pagos: 1, anuncio: { id: 7, keyword: 'GUIA PERU' } } });
        render(<VentasSinPalabra anuncios={ANUNCIOS} />);
        await user.click(await screen.findByRole('button', { name: '1 cliente con palabra clave' }));
        await user.click(screen.getByRole('button', { name: 'Cambiar la palabra clave de Caro Paz' }));

        const tarjeta = screen.getByRole('listitem', { name: 'Ventas de Caro Paz' });
        await waitFor(() => expect(within(tarjeta).getByRole('combobox')).toHaveFocus());
        await user.keyboard('guia{Enter}');

        expect(api.post).toHaveBeenCalledWith('/setter/palabras-clave/ventas', { grupo: 'c3', ad_id: 7 });
        await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Ventas de Caro Paz' })).not.toBeInTheDocument());
        expect(screen.getByText('GUIA PERU')).toBeInTheDocument();
        // Sigue en las que tienen palabra clave, y no se suma a las pendientes.
        expect(screen.getByRole('button', { name: '1 cliente con palabra clave' })).toBeInTheDocument();
    });

    it('sin ventas de sus leads no muestra nada', async () => {
        api.get.mockResolvedValue({ data: { pendientes: [], completadas: [], resumen: { clientes: 0, monto: 0 } } });
        const { container } = render(<VentasSinPalabra anuncios={ANUNCIOS} />);
        await waitFor(() => expect(api.get).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
