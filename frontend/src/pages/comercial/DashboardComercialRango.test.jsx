import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import DashboardComercial from './DashboardComercial';

/**
 * El período y la comparación del dashboard comercial, de punta a punta: lo que se elige en la
 * barra, lo que queda en la URL y lo que de verdad sale en el pedido HTTP.
 *
 * Se mockea `api` y no `comercialApi` a propósito: el bug era que "Personalizado" no mandaba
 * fechas, y eso solo se ve en los parámetros del pedido (`filtrosQuery` incluido).
 */

vi.mock('../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 99, role: 'director_comercial', is_impersonating: false } }),
}));
// Analizar y Revisar se reemplazan por dobles que dicen qué rango recibieron.
vi.mock('./components/Analizar', () => ({
    default: ({ datos, irA }) => (
        <div data-testid="analizar">
            {datos?.dates ? `${datos.dates.start}..${datos.dates.end}` : 'sin datos'}
            {irA && <button type="button" onClick={() => irA('agendas', { __de: 'Agendas' })}>ver agendas</button>}
        </div>
    ),
}));
vi.mock('./components/Revisar', async (importOriginal) => ({
    ...(await importOriginal()),
    default: ({ alcance }) => <div data-testid="revisar">{alcance}</div>,
}));

const CONTEXTO = {
    puede_elegir_equipo: true, puede_reportar: true, rol: 'closers', miembro_id: null,
    yo: { id: 99, rol: 'director_comercial', nombre: 'Director' },
    miembros: [], miembros_por_rol: { closers: [], setters: [] }, estados: [],
    periodos: [{ key: 'hoy', label: 'Hoy' }, { key: 'mes', label: 'Este mes' },
        { key: 'custom', label: 'Personalizado' }],
    comparaciones: [{ key: 'prev', label: 'Período anterior' }, { key: 'custom', label: 'Personalizado' },
        { key: 'none', label: 'Sin comparar' }],
};

/** Un backend de mentira que, como el de verdad, devuelve en `dates` el rango que usó. */
const responder = (ruta, config = {}) => {
    const p = config.params || {};
    const preset = p.period === 'hoy' ? ['2026-09-17', '2026-09-17'] : ['2026-09-01', '2026-09-17'];
    const dates = {
        start: p.period === 'custom' ? p.start_date : preset[0],
        end: p.period === 'custom' ? p.end_date : preset[1],
        compare_start: p.compare === 'custom' ? p.compare_start : null,
        compare_end: p.compare === 'custom' ? p.compare_end : null,
    };
    if (ruta === '/comercial/contexto') return Promise.resolve({ data: CONTEXTO });
    if (ruta === '/comercial/tabla') {
        return Promise.resolve({ data: { tabla: p.tabla, rol: p.rol, filas: [], totales: {}, dates } });
    }
    return Promise.resolve({ data: { dates } });
};

const Url = () => <output data-testid="url">{useLocation().search}</output>;

const montar = (url = '/x', props = {}) => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial {...props} />
        <Url />
    </MemoryRouter>,
);

const pedidosA = (ruta) => api.get.mock.calls.filter(([r]) => r === ruta).map(([, c]) => c.params);

beforeEach(() => {
    // Solo el reloj: los `setTimeout` y las promesas siguen siendo los de verdad.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 17, 21, 30));
    api.get.mockReset();
    api.get.mockImplementation(responder);
});
afterEach(() => vi.useRealTimers());

describe('DashboardComercial · pedidos que vuelven desordenados', () => {
    it('una respuesta vieja que llega tarde no pisa la del filtro elegido', async () => {
        let soltarVieja;
        api.get.mockImplementation((ruta, config) => {
            if (ruta === '/comercial/resumen' && config.params.period === 'mes') {
                return new Promise((resolver) => {
                    soltarVieja = () => resolver({ data: { dates: { start: '2026-09-01', end: '2026-09-17' } } });
                });
            }
            return responder(ruta, config);
        });
        montar('/x?p=mes');

        fireEvent.click(await screen.findByRole('button', { name: /Este mes/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Hoy' }));
        await waitFor(() => expect(screen.getByTestId('analizar')).toHaveTextContent('2026-09-17..2026-09-17'));

        // Llega la de "Este mes", que ya no es lo elegido: no tiene que dibujarse.
        await act(async () => soltarVieja());
        expect(screen.getByTestId('analizar')).toHaveTextContent('2026-09-17..2026-09-17');
        expect(pedidosA('/comercial/resumen').map(p => p.period)).toEqual(['mes', 'hoy']);
    });
});

const fecha = (rotulo) => screen.getAllByLabelText(rotulo).at(-1);
/** Tipea una fecha y sale del campo, que es cuando se confirma. */
const ponerFecha = (rotulo, valor) => {
    const campo = fecha(rotulo);
    fireEvent.change(campo, { target: { value: valor } });
    fireEvent.blur(campo);
};
const elegir = async (pildora, opcion) => {
    fireEvent.click(await screen.findByRole('button', { name: pildora }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: opcion }));
};
const url = () => new URLSearchParams(screen.getByTestId('url').textContent);

describe('DashboardComercial · período personalizado', () => {
    it('elegir "Personalizado" muestra las dos fechas, arrancando del rango que se estaba viendo', async () => {
        montar('/x?p=mes');
        await waitFor(() => expect(screen.getByTestId('analizar')).toHaveTextContent('2026-09-01..2026-09-17'));

        await elegir(/Este mes/, 'Personalizado');

        // El menú queda abierto: elegir "Personalizado" sin poder poner las fechas no sirve de nada.
        expect(fecha('Período: desde')).toHaveValue('2026-09-01');
        expect(fecha('Período: hasta')).toHaveValue('2026-09-17');
        expect(Object.fromEntries(url())).toMatchObject({ p: 'custom', d: '2026-09-01', h: '2026-09-17' });
    });

    it('las dos fechas viajan como start_date y end_date, y la píldora dice el rango', async () => {
        montar('/x?p=mes');
        await elegir(/Este mes/, 'Personalizado');

        ponerFecha('Período: desde', '2026-09-08');
        ponerFecha('Período: hasta', '2026-09-14');

        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1))
            .toMatchObject({ period: 'custom', start_date: '2026-09-08', end_date: '2026-09-14' }));
        expect(screen.getByRole('button', { name: /08\/09 – 14\/09/ })).toBeInTheDocument();
        expect(Object.fromEntries(url())).toMatchObject({ p: 'custom', d: '2026-09-08', h: '2026-09-14' });
    });

    it('un solo día: desde y hasta iguales', async () => {
        montar('/x?p=custom&d=2026-09-01&h=2026-09-17');
        fireEvent.click(await screen.findByRole('button', { name: /01\/09 – 17\/09/ }));

        ponerFecha('Período: desde', '2026-09-10');
        ponerFecha('Período: hasta', '2026-09-10');

        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1))
            .toMatchObject({ start_date: '2026-09-10', end_date: '2026-09-10' }));
        expect(screen.getByRole('button', { name: /^\s*10\/09\s*$/ })).toBeInTheDocument();
    });

    it('el calendario del navegador elige sin sacar el foco: igual se pide, tras una pausa', async () => {
        montar('/x?p=custom&d=2026-09-01&h=2026-09-17');
        fireEvent.click(await screen.findByRole('button', { name: /01\/09 – 17\/09/ }));

        fireEvent.change(fecha('Período: hasta'), { target: { value: '2026-09-05' } });

        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1))
            .toMatchObject({ start_date: '2026-09-01', end_date: '2026-09-05' }));
    });

    it('cerrar el menú enseguida de elegir la fecha no la descarta', async () => {
        montar('/x?p=custom&d=2026-09-01&h=2026-09-17');
        fireEvent.click(await screen.findByRole('button', { name: /01\/09 – 17\/09/ }));

        fireEvent.change(fecha('Período: hasta'), { target: { value: '2026-09-05' } });
        fireEvent.mouseDown(document.body);
        await act(async () => {});

        // Antes de la pausa: la confirma el cierre del menú, no la espera.
        expect(screen.queryByLabelText('Período: hasta')).not.toBeInTheDocument();
        expect(url().get('h')).toBe('2026-09-05');
    });

    it('con una fecha sola no pide nada y pide la que falta, ahí mismo', async () => {
        montar('/x?p=custom&d=2026-09-08');

        expect(await screen.findByText('Elegí las dos fechas del período.')).toBeInTheDocument();
        expect(screen.queryByTestId('analizar')).not.toBeInTheDocument();
        expect(pedidosA('/comercial/resumen')).toEqual([]);

        ponerFecha('Período: hasta', '2026-09-14');

        await waitFor(() => expect(pedidosA('/comercial/resumen'))
            .toEqual([expect.objectContaining({ start_date: '2026-09-08', end_date: '2026-09-14' })]));
        expect(screen.queryByText('Elegí las dos fechas del período.')).not.toBeInTheDocument();
    });

    it('borrar una fecha deja de pedir, en vez de seguir mostrando el rango viejo', async () => {
        montar('/x?p=custom&d=2026-09-08&h=2026-09-14');
        fireEvent.click(await screen.findByRole('button', { name: /08\/09 – 14\/09/ }));
        await waitFor(() => expect(pedidosA('/comercial/resumen')).toHaveLength(1));

        ponerFecha('Período: hasta', '');

        expect(await screen.findByText('Elegí las dos fechas del período.')).toBeInTheDocument();
        expect(url().get('h')).toBeNull();
        expect(pedidosA('/comercial/resumen')).toHaveLength(1);
    });

    it('nunca queda al revés: si "desde" pasa a "hasta", el otro extremo lo sigue', async () => {
        montar('/x?p=custom&d=2026-09-08&h=2026-09-14');
        fireEvent.click(await screen.findByRole('button', { name: /08\/09 – 14\/09/ }));

        ponerFecha('Período: desde', '2026-09-20');

        expect(fecha('Período: hasta')).toHaveValue('2026-09-20');
        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1))
            .toMatchObject({ start_date: '2026-09-20', end_date: '2026-09-20' }));

        ponerFecha('Período: hasta', '2026-09-02');
        expect(fecha('Período: desde')).toHaveValue('2026-09-02');
    });

    it('un link con las fechas al revés se da vuelta', async () => {
        montar('/x?p=custom&d=2026-09-14&h=2026-09-08');

        expect(await screen.findByRole('button', { name: /08\/09 – 14\/09/ })).toBeInTheDocument();
        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1))
            .toMatchObject({ start_date: '2026-09-08', end_date: '2026-09-14' }));
    });

    it('el drill-down a Revisar conserva el rango: en la URL, en el pedido y en la línea de alcance', async () => {
        montar('/x?p=custom&d=2026-09-08&h=2026-09-14');

        fireEvent.click(await screen.findByRole('button', { name: 'ver agendas' }));

        expect(await screen.findByTestId('revisar')).toHaveTextContent('Todo el equipo · 08/09 – 14/09');
        expect(Object.fromEntries(url()))
            .toMatchObject({ s: 'revisar', t: 'agendas', p: 'custom', d: '2026-09-08', h: '2026-09-14' });
        await waitFor(() => expect(pedidosA('/comercial/tabla').at(-1))
            .toMatchObject({ tabla: 'agendas', period: 'custom', start_date: '2026-09-08', end_date: '2026-09-14' }));
    });

    it('embebido, le pasa al host la URL del drill-down con las fechas', async () => {
        const onIrASeccion = vi.fn();
        montar('/x?step=datos&p=custom&d=2026-09-08&h=2026-09-14',
            { embebido: true, seccionFija: 'analizar', onIrASeccion });

        fireEvent.click(await screen.findByRole('button', { name: 'ver agendas' }));

        const [, query] = onIrASeccion.mock.calls[0];
        expect([query.get('p'), query.get('d'), query.get('h')]).toEqual(['custom', '2026-09-08', '2026-09-14']);
    });

    it('elegir otro período suelta las fechas', async () => {
        montar('/x?p=custom&d=2026-09-08&h=2026-09-14');

        await elegir(/08\/09 – 14\/09/, 'Hoy');

        expect(url().get('p')).toBe('hoy');
        expect([url().get('d'), url().get('h')]).toEqual([null, null]);
        await waitFor(() => expect(pedidosA('/comercial/resumen').at(-1)).not.toHaveProperty('start_date'));
    });
});
