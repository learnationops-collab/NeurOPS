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
