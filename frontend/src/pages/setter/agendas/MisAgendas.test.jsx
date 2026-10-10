import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MisAgendas from './MisAgendas';

/**
 * «Mis agendas»: la bandeja de palabras clave del setter (pedido de Kerwin, 10/10/2026).
 *
 * "Debe vaciarse para completar el proceso de asignación de palabra clave y mostrarle un premio por
 * completarlo, como en un juego". Lo que se prueba: vaciarla solo con el teclado (escribir, Enter, y
 * el foco pasa a la que sigue), que cada asignación se note (la tarjeta se va, "Te quedan" baja) y
 * que el premio sea para quien la vacía, no para quien entra y ya estaba vacía.
 */

const red = vi.hoisted(() => ({ pendientes: [], resumen: null, post: null, posts: [] }));

const ANUNCIOS = [
    { id: 1, keyword: 'CURSO GRATUITO', nombre: 'CURSO GRATUITO', activo: true, usos: 3 },
    { id: 2, keyword: 'GUIA', nombre: 'GUIA', activo: true, usos: 0 },
    { id: 3, keyword: 'PROTOCOLO', nombre: 'PROTOCOLO', activo: true, usos: 0 },
];

const agenda = (id, cliente, extra = {}) => ({
    id, client_id: id * 10, cliente, instagram: cliente.toLowerCase(), telefono: '', reunion: '2026-10-12T14:00:00',
    creada: '2026-10-08T14:00:00', closer: 'Marlon', canal: null, sugerido: null,
    estado: { key: 'confirmada', label: 'Confirmada', tone: 'info' }, ...extra,
});

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url === '/setter/palabras-clave'
                ? { pendientes: red.pendientes, anuncios: ANUNCIOS, resumen: red.resumen }
                : url === '/setter/commission' ? { rate: 0.08, cash_neto: 12500, commission: 1000 } : [],
        })),
        post: vi.fn((url, cuerpo) => {
            red.posts.push(cuerpo);
            return red.post(cuerpo);
        }),
    },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/** El backend de mentira: saca la agenda y devuelve el resumen recalculado. */
const backendQueAsigna = () => (cuerpo) => {
    red.pendientes = red.pendientes.filter(a => a.id !== cuerpo.appointment_id);
    red.resumen = { pendientes: red.pendientes.length, hoy: red.resumen.hoy + 1, racha: red.pendientes.length ? 0 : 1 };
    return Promise.resolve({ data: { appointment_id: cuerpo.appointment_id, resumen: red.resumen } });
};

const montar = async (props = {}) => {
    const onResumen = vi.fn();
    render(<MisAgendas onResumen={onResumen} onVerDatos={vi.fn()} {...props} />);
    await screen.findByLabelText('Tu avance');
    await act(async () => {});
    return { onResumen };
};

const tarjeta = (nombre) => screen.getByRole('listitem', { name: `Agenda de ${nombre}` });
const buscadorDe = (nombre) => within(tarjeta(nombre)).getByRole('combobox');

const asignarConTeclado = async (nombre, texto) => {
    const campo = buscadorDe(nombre);
    fireEvent.change(campo, { target: { value: texto } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });
};

describe('MisAgendas · la bandeja de palabras clave', () => {
    beforeEach(() => {
        red.pendientes = [agenda(11, 'Ana'), agenda(12, 'Beto'), agenda(13, 'Caro', { instagram: null })];
        red.resumen = { pendientes: 3, hoy: 0, racha: 0 };
        red.posts = [];
        red.post = backendQueAsigna();
        // jsdom no tiene requestAnimationFrame con frames reales: que corra enseguida.
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    });

    it('muestra cada agenda legible de un vistazo y cuántas quedan', async () => {
        const { onResumen } = await montar();

        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('3agendas sin palabra clave');
        const ana = tarjeta('Ana');
        expect(within(ana).getByRole('heading', { name: 'Ana' })).toBeInTheDocument();
        expect(within(ana).getByText('Marlon')).toBeInTheDocument();
        expect(within(ana).getByText('Confirmada')).toBeInTheDocument();
        expect(within(ana).getByRole('link', { name: /@ana/ })).toHaveAttribute('href', 'https://instagram.com/ana');
        // Sin Instagram el campo está abierto: es la llave de la atribución.
        expect(within(tarjeta('Caro')).getByLabelText('Instagram de Caro')).toHaveValue('');
        expect(screen.getByText('$1,000')).toBeInTheDocument();
        expect(onResumen).toHaveBeenCalledWith({ pendientes: 3, hoy: 0, racha: 0 });
    });

    it('asignar con Enter saca la tarjeta, baja el contador y pasa el foco a la que sigue', async () => {
        const { onResumen } = await montar();

        await asignarConTeclado('Ana', 'guia');

        expect(red.posts).toEqual([{ appointment_id: 11, ad_id: 2 }]);
        await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Agenda de Ana' })).toBeNull());
        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('2agendas sin palabra clave');
        expect(screen.getByText(/de 3 hoy/)).toHaveTextContent('1 de 3 hoy');
        expect(document.activeElement).toBe(buscadorDe('Beto'));
        expect(onResumen).toHaveBeenLastCalledWith({ pendientes: 2, hoy: 1, racha: 0 });
    });

    it('vaciarla del todo da el premio, con lo hecho hoy y la racha', async () => {
        red.pendientes = [agenda(11, 'Ana'), agenda(12, 'Beto')];
        red.resumen = { pendientes: 2, hoy: 0, racha: 0 };
        await montar();

        await asignarConTeclado('Ana', 'guia');
        await asignarConTeclado('Beto', 'proto');

        expect(await screen.findByRole('heading', { name: '¡Bandeja vacía!' })).toBeInTheDocument();
        expect(screen.getByText(/Completaste 2 agendas hoy/)).toBeInTheDocument();
        expect(screen.getByText('Primer día de racha')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ver mis datos/ })).toBeInTheDocument();
    });

    it('si ya estaba vacía al entrar, "Todo al día" sin festejo', async () => {
        red.pendientes = [];
        red.resumen = { pendientes: 0, hoy: 4, racha: 5 };
        await montar();

        expect(screen.getByRole('heading', { name: 'Todo al día' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '¡Bandeja vacía!' })).toBeNull();
        expect(screen.getByText('4 completadas hoy')).toBeInTheDocument();
        expect(screen.getByText(/5 días de racha/)).toBeInTheDocument();
    });

    it('si el backend dice que falta el Instagram, lo dice en la tarjeta y lleva el foco al campo', async () => {
        red.post = () => Promise.reject({ response: { data: { error: 'Falta el Instagram del lead: es con lo que Marketing encuentra su conversación.' } } });
        await montar();

        await asignarConTeclado('Caro', 'guia');

        expect(within(tarjeta('Caro')).getByRole('alert')).toHaveTextContent('Falta el Instagram');
        expect(document.activeElement).toBe(within(tarjeta('Caro')).getByLabelText('Instagram de Caro'));
        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('3agendas');
    });

    it('el Instagram escrito viaja con la asignación', async () => {
        await montar();
        fireEvent.change(within(tarjeta('Caro')).getByLabelText('Instagram de Caro'), { target: { value: '@caro.real' } });

        await asignarConTeclado('Caro', 'guia');

        expect(red.posts).toEqual([{ appointment_id: 13, ad_id: 2, instagram: '@caro.real' }]);
    });

    it('la palabra clave que ya decía la agenda viene elegida: Enter la asigna', async () => {
        red.pendientes = [agenda(11, 'Ana', { sugerido: 3 })];
        red.resumen = { pendientes: 1, hoy: 0, racha: 0 };
        await montar();

        const campo = buscadorDe('Ana');
        expect(campo).toHaveValue('PROTOCOLO');
        expect(screen.getByText('Palabra clave · sugerida por la agenda')).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });

        expect(red.posts).toEqual([{ appointment_id: 11, ad_id: 3 }]);
    });
});
