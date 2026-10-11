import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from '../../Revisar';
import { operacionDe } from '../operacion';
import { editarEnLote, getVenta, reenviarWebhook } from './ventasApi';

/**
 * Las acciones de Operaciones sobre las ventas, en Revisar (10/10/2026): lo que solo hacía la tabla
 * vieja de Ventas. Se prueban montadas en Revisar con el registro real (`operacionDe('ventas')`), que
 * es como las ve quien opera; la dirección y los closers no reciben `operacion` y no ven ninguna.
 */

vi.mock('./ventasApi', () => ({
    getVenta: vi.fn(),
    reenviarWebhook: vi.fn(() => Promise.resolve({ status: 'success' })),
    editarEnLote: vi.fn(() => Promise.resolve({ message: '2 ventas actualizadas con éxito' })),
    getOpcionesDeLote: vi.fn(() => Promise.resolve({ closers: ['Marlon', 'Nerina'], setters: ['workshop', 'Elias'] })),
}));
// El modal de la tabla vieja busca agendas, setters y closers por su cuenta.
vi.mock('../../../../../services/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: [] })), put: vi.fn(), post: vi.fn() },
}));

const chip = (key, label, tone = 'info') => ({ key, label, tone });
const COMPLETADA = chip('completada', 'Completada', 'success');

const venta = (id, cliente, extra = {}) => ({
    tipo: 'venta', id, client_id: id, cliente, ig: '', email: '', telefono: '', closer: 'Nerina', setter: '',
    programa: 'Residency Roadmap', fecha: `2026-09-0${id}T15:00:00`, metodo: 'zelle', monto: 1000,
    monto_neto: 1000, es_venta: true, academia: null, sena_estado: null,
    tipo_pago: chip('completo', 'Pago completo', 'success'), tipo_pago_raw: 'RR - Completo',
    estado: COMPLETADA, completada: true, tiene_agenda: true, ...extra,
});
// Como las recibe quien opera (`operar=1`): con su estado y si tienen agenda.
const FILAS = [
    venta(1, 'Ana Gomez', { monto: 2000 }),
    venta(2, 'Beto Diaz', { metodo: 'Stripe', tiene_agenda: false }),
    venta(3, 'Caro Paz', { estado: chip('pendiente', 'Pendiente', 'warning'), completada: false,
        tiene_agenda: false }),
];

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, cargando: false, rol: 'closers', basis: 'meet', setBasis: () => {},
    alcance: 'Todo el equipo', onAbrirFila: vi.fn(), filtroInicial: null, onOlvidarFiltro: () => {},
    puedeElegirEquipo: true, ...extra,
});
const comoOperador = (extra = {}) => render(
    <Revisar {...props({ datos: { filas: FILAS, dates: { start: '2026-09-01', end: '2026-09-30' } },
        operacion: operacionDe('ventas'), ...extra })} />);
const tildar = (nombre) => fireEvent.click(screen.getByRole('checkbox', { name: `Seleccionar ${nombre}` }));
const opcionesDelMenu = () => screen.getAllByRole('menuitem').map(b => b.textContent);

beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
});

describe('Ventas · las acciones de la fila', () => {
    it('«Atribuir a una agenda» solo en las ventas sin agenda; «Reenviar webhook» en todas', () => {
        comoOperador();
        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Ana Gomez' }));
        expect(opcionesDelMenu()).toEqual(['Reenviar webhook']);
        fireEvent.keyDown(document, { key: 'Escape' });

        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Beto Diaz' }));
        expect(opcionesDelMenu()).toEqual(['Atribuir a una agenda', 'Reenviar webhook']);
    });

    it('sin `operacion` (la dirección, los closers) no hay casillas ni «⋯»', () => {
        render(<Revisar {...props({ datos: { filas: FILAS.filter(f => f.completada) } })} />);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /^Acciones de/ })).toBeNull();
    });

    it('reenviar el webhook pide confirmación y manda el id de la venta', async () => {
        comoOperador();
        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Ana Gomez' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Reenviar webhook' }));

        const dialogo = screen.getByRole('alertdialog');
        expect(dialogo).toHaveTextContent('Ana Gomez');
        expect(reenviarWebhook).not.toHaveBeenCalled();
        fireEvent.click(within(dialogo).getByRole('button', { name: 'Reenviar' }));

        await waitFor(() => expect(reenviarWebhook).toHaveBeenCalledWith(1));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('si el reenvío falla, el motivo se dice adentro y el diálogo sigue abierto', async () => {
        reenviarWebhook.mockRejectedValueOnce({ response: { data: { error: 'n8n no respondió' } } });
        comoOperador();
        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Ana Gomez' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Reenviar webhook' }));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reenviar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('n8n no respondió');
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('atribuir abre el modal de la tabla vieja con la venta pedida por su id', async () => {
        getVenta.mockResolvedValue({ id: 2, nombre_cliente: 'Beto Diaz', instagram: 'betod',
            email_vendedor: 'nerina@x.com', mail_cliente: 'beto@x.com', telefono: '', date: '2026-09-02T15:00:00' });
        comoOperador();
        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Beto Diaz' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Atribuir a una agenda' }));

        expect(getVenta).toHaveBeenCalledWith(2);
        expect(await screen.findByText('Atribución de Agenda para Venta')).toBeInTheDocument();
        expect(screen.getByDisplayValue('betod')).toBeInTheDocument();
    });
});

describe('Ventas · editar en lote', () => {
    const abrirPanel = () => {
        tildar('Ana Gomez');
        tildar('Beto Diaz');
        const barra = screen.getByRole('region', { name: 'Filas seleccionadas' });
        fireEvent.click(within(barra).getByRole('button', { name: 'Editar en lote' }));
        return screen.getByRole('dialog', { name: 'Editar en lote' });
    };

    it('cada campo arranca en «No cambiar» y sin cambios no se puede seguir', async () => {
        comoOperador();
        const panel = abrirPanel();

        await waitFor(() => expect(within(panel).getByLabelText('Closer')).not.toBeDisabled());
        ['Programa', 'Tipo de pago', 'Método', 'Estado', 'Closer', 'Setter'].forEach(campo => {
            const select = within(panel).getByLabelText(campo);
            expect(select).toHaveValue('');
            expect(select.selectedOptions[0].textContent).toBe('No cambiar');
        });
        // Los closers y los setters, de donde los sacaba la tabla vieja.
        expect(within(panel).getByRole('option', { name: 'Marlon' })).toBeInTheDocument();
        expect(within(panel).getByRole('option', { name: 'workshop' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Revisar los cambios/ })).toBeDisabled();
    });

    it('muestra un resumen antes de aplicar y manda solo lo que cambia', async () => {
        const onRecargar = vi.fn();
        comoOperador({ onRecargar });
        const panel = abrirPanel();

        fireEvent.change(within(panel).getByLabelText('Estado'), { target: { value: 'Reembolsada' } });
        fireEvent.change(within(panel).getByLabelText('Método'), { target: { value: '__otro__' } });
        // «Otro…» sin escribir todavía no dice a qué cambia.
        expect(screen.getByRole('button', { name: /Revisar los cambios/ })).toBeDisabled();
        fireEvent.change(within(panel).getByLabelText('Otro método'), { target: { value: 'Zelle' } });
        fireEvent.click(screen.getByRole('button', { name: /Revisar los cambios/ }));

        const resumen = screen.getByRole('region', { name: 'Resumen de los cambios' });
        expect(resumen).toHaveTextContent('Método');
        expect(resumen).toHaveTextContent('Zelle');
        expect(resumen).toHaveTextContent('Hoy: zelle · Stripe');
        expect(resumen).toHaveTextContent('Reembolsada');
        expect(resumen).toHaveTextContent('Hoy: Completada ×2');
        expect(editarEnLote).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 2 ventas' }));

        await waitFor(() => expect(editarEnLote).toHaveBeenCalledWith([1, 2],
            { metodo_pago: 'Zelle', estado: 'Reembolsada' }));
        await waitFor(() => expect(onRecargar).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('dialog', { name: 'Editar en lote' })).toBeNull();
    });

    it('si el backend rechaza el lote, lo dice adentro y no cierra', async () => {
        editarEnLote.mockRejectedValueOnce({ response: { data: { error: 'No se encontraron ventas para actualizar' } } });
        const onRecargar = vi.fn();
        comoOperador({ onRecargar });
        const panel = abrirPanel();
        fireEvent.change(within(panel).getByLabelText('Programa'), { target: { value: 'AL' } });
        fireEvent.click(screen.getByRole('button', { name: /Revisar los cambios/ }));
        expect(screen.getByRole('region', { name: 'Resumen de los cambios' })).toHaveTextContent('Ace Learner (AL)');
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 2 ventas' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No se encontraron ventas para actualizar');
        expect(onRecargar).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'Editar en lote' })).toBeInTheDocument();
    });
});
