import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MisAgendas from './MisAgendas';
import api from '../../../services/api';

/**
 * «Mis agendas»: la bandeja de palabras clave del setter (pedido de Kerwin, 10/10/2026).
 *
 * "Debe vaciarse para completar el proceso de asignación de palabra clave y mostrarle un premio por
 * completarlo, como en un juego". Lo que se prueba: vaciarla solo con el teclado (escribir, Enter, y
 * el foco pasa a la que sigue), que cada asignación se note (la tarjeta se va, "Te quedan" baja) y
 * que el premio sea para quien la vacía, no para quien entra y ya estaba vacía.
 *
 * Desde el 11/10/2026 va un mes por vez («que le vayamos pidiendo de a poquito»): abre en el actual,
 * el selector cambia de mes y al vaciar uno el premio llama al que sigue.
 */

const red = vi.hoisted(() => ({ pendientes: [], resumen: null, post: null, posts: [] }));

const ANUNCIOS = [
    { id: 1, keyword: 'CURSO GRATUITO', nombre: 'CURSO GRATUITO', activo: true, usos: 3 },
    { id: 2, keyword: 'GUIA', nombre: 'GUIA', activo: true, usos: 0 },
    { id: 3, keyword: 'PROTOCOLO', nombre: 'PROTOCOLO', activo: true, usos: 0 },
];

const agenda = (id, cliente, extra = {}) => ({
    id, client_id: id * 10, cliente, instagram: cliente.toLowerCase(), telefono: '', reunion: '2026-10-12T14:00:00',
    creada: '2026-10-08T14:00:00', mes: '2026-10', closer: 'Marlon', canal: null, sugerido: null,
    estado: { key: 'confirmada', label: 'Confirmada', tone: 'info' }, ...extra,
});

/** Los totales de cada mes: los que vienen en `extra` y, si no, lo que haya pendiente. */
let TOTALES = {};
const MESES = ['2026-10', '2026-09', '2026-08', '2026-07'];

/** El resumen como lo arma el backend: lo que se festeja y la bandeja por mes. */
const resumenDe = (pendientes, juego = {}) => ({
    pendientes: pendientes.length, hoy: 0, racha: 0, ...juego, mes_actual: '2026-10',
    meses: MESES.map(mes => {
        const faltan = pendientes.filter(a => a.mes === mes).length;
        return { mes, pendientes: faltan, total: Math.max(TOTALES[mes] || 0, faltan) };
    }),
});

/** Lo que contesta el backend de mentira a cada GET. */
const responder = (url) => Promise.resolve({
    data: url === '/setter/palabras-clave'
        ? { pendientes: red.pendientes, anuncios: ANUNCIOS, resumen: red.resumen }
        : url === '/setter/commission' ? { rate: 0.08, cash_neto: 12500, commission: 1000 } : [],
});

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn((url) => responder(url)),
        post: vi.fn((url, cuerpo) => {
            red.posts.push(cuerpo);
            return red.post(cuerpo, url);
        }),
    },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/** El backend de mentira: saca la agenda y devuelve el resumen recalculado. */
const backendQueAsigna = () => (cuerpo) => {
    red.pendientes = red.pendientes.filter(a => a.id !== cuerpo.appointment_id);
    red.resumen = resumenDe(red.pendientes, { hoy: red.resumen.hoy + 1, racha: red.pendientes.length ? 0 : 1 });
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
        TOTALES = { '2026-10': 3 };
        red.pendientes = [agenda(11, 'Ana'), agenda(12, 'Beto'), agenda(13, 'Caro', { instagram: null })];
        red.resumen = resumenDe(red.pendientes);
        red.posts = [];
        red.post = backendQueAsigna();
        // jsdom no tiene requestAnimationFrame con frames reales: que corra enseguida.
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    });

    it('muestra cada agenda legible de un vistazo y cuántas quedan', async () => {
        const { onResumen } = await montar();

        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('3sin palabra clave en octubre');
        const ana = tarjeta('Ana');
        expect(within(ana).getByRole('heading', { name: 'Ana' })).toBeInTheDocument();
        expect(within(ana).getByText('Marlon')).toBeInTheDocument();
        expect(within(ana).getByText('Confirmada')).toBeInTheDocument();
        expect(within(ana).getByRole('link', { name: /@ana/ })).toHaveAttribute('href', 'https://instagram.com/ana');
        // Sin Instagram el campo está abierto: es la llave de la atribución.
        expect(within(tarjeta('Caro')).getByLabelText('Instagram de Caro')).toHaveValue('');
        // La comisión se fue a «Mis datos» (11/10/2026): acá ni se pide.
        expect(screen.queryByText('$1,000')).toBeNull();
        expect(api.get).not.toHaveBeenCalledWith('/setter/commission');
        expect(onResumen).toHaveBeenCalledWith(red.resumen);
    });

    it('asignar con Enter saca la tarjeta, baja el contador y pasa el foco a la que sigue', async () => {
        const { onResumen } = await montar();

        await asignarConTeclado('Ana', 'guia');

        expect(red.posts).toEqual([{ appointment_id: 11, ad_id: 2 }]);
        await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Agenda de Ana' })).toBeNull());
        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('2sin palabra clave en octubre');
        expect(screen.getByRole('progressbar', { name: 'Con palabra clave en octubre' })).toHaveAttribute('aria-valuenow', '1');
        expect(document.activeElement).toBe(buscadorDe('Beto'));
        expect(onResumen).toHaveBeenLastCalledWith(expect.objectContaining({ pendientes: 2, hoy: 1, racha: 0 }));
    });

    it('vaciarla del todo da el premio, con lo hecho hoy y la racha', async () => {
        red.pendientes = [agenda(11, 'Ana'), agenda(12, 'Beto')];
        red.resumen = resumenDe(red.pendientes);
        await montar();

        await asignarConTeclado('Ana', 'guia');
        await asignarConTeclado('Beto', 'proto');

        expect(await screen.findByRole('heading', { name: '¡Bandeja vacía!' })).toBeInTheDocument();
        expect(screen.getByText('2 completadas hoy')).toBeInTheDocument();
        // Ningún otro mes al que llamar.
        expect(screen.queryByRole('button', { name: /Seguí con/ })).toBeNull();
        expect(screen.getByText('Primer día de racha')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ver mis datos/ })).toBeInTheDocument();
    });

    it('una carga que vuelve tarde, con la bandeja de antes, no pisa lo asignado ni tapa el festejo', async () => {
        // Reclamar una agenda sin dueño recarga la bandeja; si esa carga vuelve DESPUÉS de asignar, trae
        // la bandeja de antes y no puede resucitar la tarjeta ni cambiar el festejo por "Todo al día".
        red.pendientes = [agenda(11, 'Ana')];
        red.resumen = resumenDe(red.pendientes);
        const vieja = { pendientes: [agenda(11, 'Ana')], anuncios: ANUNCIOS, resumen: resumenDe([agenda(11, 'Ana')]) };
        let soltar;
        let cargas = 0;
        api.get.mockImplementation((url) => {
            if (url === '/setter/agendas/sin-asignar') {
                return Promise.resolve({ data: [{ id: 99, lead_name: 'Sin Dueño', fuente: 'setting', start_time: null }] });
            }
            if (url === '/setter/palabras-clave' && ++cargas === 2) {
                return new Promise((r) => { soltar = () => r({ data: vieja }); });
            }
            return responder(url);
        });
        const asigna = backendQueAsigna();
        red.post = (cuerpo, url) => (url.includes('/reclamar')
            ? Promise.resolve({ data: { accion: 'mia' } }) : asigna(cuerpo));
        await montar();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Es mía/ })); });
        await asignarConTeclado('Ana', 'guia');
        expect(await screen.findByRole('heading', { name: '¡Bandeja vacía!' })).toBeInTheDocument();
        await act(async () => { soltar?.(); });

        expect(screen.getByRole('heading', { name: '¡Bandeja vacía!' })).toBeInTheDocument();
        expect(screen.queryByRole('listitem', { name: 'Agenda de Ana' })).toBeNull();
        api.get.mockImplementation(responder);
    });

    it('si ya estaba vacía al entrar, "Todo al día" sin festejo', async () => {
        red.pendientes = [];
        red.resumen = resumenDe([], { hoy: 4, racha: 5 });
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
        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('3sin palabra clave');
    });

    it('el Instagram escrito viaja con la asignación', async () => {
        await montar();
        fireEvent.change(within(tarjeta('Caro')).getByLabelText('Instagram de Caro'), { target: { value: '@caro.real' } });

        await asignarConTeclado('Caro', 'guia');

        expect(red.posts).toEqual([{ appointment_id: 13, ad_id: 2, instagram: '@caro.real' }]);
    });

    it('la palabra clave que ya decía la agenda viene elegida: Enter la asigna', async () => {
        red.pendientes = [agenda(11, 'Ana', { sugerido: 3 })];
        red.resumen = resumenDe(red.pendientes);
        await montar();

        const campo = buscadorDe('Ana');
        expect(campo).toHaveValue('PROTOCOLO');
        expect(screen.getByText('Palabra clave · sugerida por la agenda')).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });

        expect(red.posts).toEqual([{ appointment_id: 11, ad_id: 3 }]);
    });
});

describe('MisAgendas · un mes por vez', () => {
    beforeEach(() => {
        // Octubre (el actual) con dos; septiembre con dos; agosto completo; julio sin agendas.
        TOTALES = { '2026-10': 5, '2026-09': 20, '2026-08': 12 };
        red.pendientes = [
            agenda(11, 'Ana'), agenda(12, 'Beto'),
            agenda(21, 'Caro', { mes: '2026-09', creada: '2026-09-20T10:00:00' }),
            agenda(22, 'Dani', { mes: '2026-09', creada: '2026-09-02T10:00:00' }),
        ];
        red.resumen = resumenDe(red.pendientes);
        red.posts = [];
        red.post = backendQueAsigna();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    });

    const mesesDelSelector = () => within(screen.getByRole('navigation', { name: 'Meses' }))
        .getAllByRole('button').map(b => b.textContent);

    it('abre en el mes actual: solo sus agendas, con su contador, y el selector del más nuevo al más viejo', async () => {
        await montar();

        expect(screen.getByRole('heading', { name: 'Octubre · 2' })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem').map(li => li.getAttribute('aria-label'))).toEqual(['Agenda de Ana', 'Agenda de Beto']);
        // Julio no tiene ninguna agenda: no está. Agosto está completo.
        expect(mesesDelSelector()).toEqual(['Oct2', 'Sep2', 'Ago']);
        expect(screen.getByRole('button', { name: 'Agosto, completo' })).toHaveAttribute('title', 'Agosto: completo');
        expect(screen.getByRole('button', { name: 'Octubre, 2 sin palabra clave' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Te quedan').parentElement).toHaveTextContent('2sin palabra clave en octubre');
        // La barra es la del mes: 3 de 5 ya tienen su anuncio.
        expect(screen.getByRole('progressbar', { name: 'Con palabra clave en octubre' })).toHaveAttribute('aria-valuenow', '3');
    });

    it('el selector cambia de mes', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Septiembre, 2 sin palabra clave' }));

        expect(screen.getByRole('heading', { name: 'Septiembre · 2' })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem').map(li => li.getAttribute('aria-label'))).toEqual(['Agenda de Caro', 'Agenda de Dani']);
        expect(screen.getByRole('button', { name: 'Septiembre, 2 sin palabra clave' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('vaciar el mes con el teclado da el premio y el llamado al mes anterior; Enter sigue con ése', async () => {
        const { onResumen } = await montar();

        await asignarConTeclado('Ana', 'guia');
        await asignarConTeclado('Beto', 'proto');

        expect(await screen.findByRole('heading', { name: '¡Octubre al día!' })).toBeInTheDocument();
        const llamado = screen.getByRole('button', { name: /Seguí con septiembre · 2/ });
        expect(document.activeElement).toBe(llamado);
        expect(mesesDelSelector()).toEqual(['Oct', 'Sep2', 'Ago']);
        expect(onResumen).toHaveBeenLastCalledWith(expect.objectContaining({ pendientes: 2 }));

        await act(async () => { fireEvent.click(llamado); });

        expect(screen.getByRole('heading', { name: 'Septiembre · 2' })).toBeInTheDocument();
        expect(document.activeElement).toBe(buscadorDe('Caro'));
        expect(screen.queryByRole('heading', { name: '¡Octubre al día!' })).toBeNull();
    });

    it('vaciar el último mes que quedaba es el premio final', async () => {
        red.pendientes = red.pendientes.filter(a => a.mes === '2026-09');
        red.resumen = resumenDe(red.pendientes);
        await montar();
        // Octubre ya estaba al día al entrar: sin festejo, y el llamado a septiembre.
        expect(screen.getByRole('heading', { name: 'Octubre al día' })).toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Seguí con septiembre/ })); });

        await asignarConTeclado('Caro', 'guia');
        await asignarConTeclado('Dani', 'guia');

        expect(await screen.findByRole('heading', { name: '¡Bandeja vacía!' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Seguí con/ })).toBeNull();
    });
});
