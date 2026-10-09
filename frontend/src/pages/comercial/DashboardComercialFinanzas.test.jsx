import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * Finanzas y Payroll (08/10/2026; antes /admin/finance y /admin/payroll) son la vista Finances,
 * /finanzas: el mismo tablero con solo esas dos en el dock. El dock de Comercial (la dirección
 * comercial) ya no las trae: son dos vistas separadas. Quién las ve lo decide el backend
 * (`puede_ver_finanzas` del contexto); acá se comprueba que el tablero lo respete.
 */

const estado = vi.hoisted(() => ({ puede: false }));
const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => navegar }));

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: true, puede_reportar: true, puede_ver_finanzas: estado.puede,
        rol: 'closers', yo: { id: 1, rol: 'admin', nombre: 'Mario' }, miembros: [], estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, role: 'admin', is_impersonating: false }, logout: vi.fn() }),
}));
vi.mock('./components/Analizar', () => ({ default: () => <div data-testid="analizar" /> }));
// El período que recibe Finanzas: el mes si es justo uno, y si no las dos fechas.
vi.mock('./components/finanzas/Finanzas', async (original) => ({
    ...(await original()),
    default: ({ tab, periodo }) => (
        <div data-testid="finanzas">{`${tab} · ${periodo.mes || `${periodo.desde} → ${periodo.hasta}`}`}</div>
    ),
}));
vi.mock('./components/finanzas/Payroll', async (original) => ({
    ...(await original()),
    default: ({ desde, hasta, onVerVentas }) => (
        <div data-testid="payroll">
            {`${desde} → ${hasta}`}
            <button type="button" onClick={() => onVerVentas({ ids: [7, 9], rotulo: 'Comisión de Andy', desde, hasta })}>
                ver ventas de Andy
            </button>
        </div>
    ),
}));

const Donde = () => {
    const { pathname, search } = useLocation();
    return <output data-testid="donde">{pathname + search}</output>;
};

// Las dos rutas como en App.jsx: /finanzas es el tablero con `espacio="finanzas"`.
const montar = (url = '/admin/comercial') => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/finanzas" element={<DashboardComercial espacio="finanzas" />} />
            <Route path="*" element={<DashboardComercial />} />
        </Routes>
        <Donde />
    </MemoryRouter>,
);

const seccionesDelDock = () => within(screen.getByRole('navigation', { name: 'Secciones del dashboard comercial' }))
    .getAllByRole('button').map(b => b.querySelector('.dock-label')?.textContent).filter(Boolean);

describe('DashboardComercial · Comercial sin Finanzas ni Payroll', () => {
    beforeEach(() => {
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('el dock de Comercial no las trae, aunque se tenga «ver finanzas»', async () => {
        estado.puede = true;
        montar();
        await screen.findByTestId('analizar');

        expect(seccionesDelDock()).toEqual(['Analizar', 'Revisar', 'Proyectar', 'Simulador', 'Reportar']);
    });

    it('un link viejo a Finanzas o Payroll en Comercial lleva a /finanzas, con el resto de la query', async () => {
        estado.puede = true;
        montar('/admin/comercial?s=payroll&x=1');

        await screen.findByTestId('payroll');
        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=payroll&x=1');
        expect(screen.queryByTestId('analizar')).toBeNull();
    });

    it('sin el permiso, el link viejo avisa en /finanzas en vez de caer en Analizar sin decir nada', async () => {
        estado.puede = false;
        montar('/admin/comercial?s=finanzas');

        expect(await screen.findByText('Sin acceso a Finanzas')).toBeTruthy();
        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=finanzas');
        expect(screen.queryByTestId('analizar')).toBeNull();
    });
});

/** /finanzas: la vista Finances, con solo estas dos secciones. */
describe('DashboardComercial · Finances (/finanzas)', () => {
    beforeEach(() => {
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('el dock trae solo Finanzas y Payroll, sin el switch Closers/Setters, y abre en Finanzas', async () => {
        estado.puede = true;
        montar('/finanzas');

        await screen.findByTestId('finanzas');
        expect(seccionesDelDock()).toEqual(['Finanzas', 'Payroll']);
        expect(screen.queryByRole('button', { name: 'Closers' })).toBeNull();
        expect(screen.queryByTestId('analizar')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Finanzas');
    });

    it('una sección de Comercial en la URL abre Finanzas, y Payroll se elige en el dock', async () => {
        estado.puede = true;
        montar('/finanzas?s=analizar');

        await screen.findByTestId('finanzas');
        const dock = screen.getByRole('navigation', { name: 'Secciones del dashboard comercial' });
        await act(async () => { fireEvent.click(within(dock).getByRole('button', { name: /Payroll/ })); });
        expect(screen.getByTestId('payroll')).toBeTruthy();
        expect(screen.queryByTestId('finanzas')).toBeNull();
    });

    it('sin «ver finanzas» avisa en vez de caer en Analizar', async () => {
        estado.puede = false;
        montar('/finanzas');

        expect(await screen.findByText('Sin acceso a Finanzas')).toBeTruthy();
        expect(screen.queryByTestId('analizar')).toBeNull();
        expect(screen.queryByTestId('finanzas')).toBeNull();
    });

    it('Finanzas trae sus cinco vistas arriba y su mes, que queda guardado', async () => {
        estado.puede = true;
        localStorage.setItem('finanzas.mes', '2026-09');
        montar('/finanzas?s=finanzas');

        expect((await screen.findByTestId('finanzas')).textContent).toBe('resumen · 2026-09');
        const vistas = screen.getByRole('tablist', { name: 'Vistas de Finanzas' });
        expect(within(vistas).getAllByRole('tab').map(t => t.textContent))
            .toEqual(['Resumen', 'Medios de pago', 'Anuncios', 'Nómina', 'Software']);
        // El período del tablero (Hoy, Este mes…) no aplica: va el mes de Finanzas.
        expect(screen.queryByRole('button', { name: /Este mes/ })).toBeNull();

        await act(async () => { fireEvent.click(within(vistas).getByRole('tab', { name: 'Nómina' })); });
        expect(screen.getByTestId('finanzas').textContent).toBe('nomina · 2026-09');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /septiembre 2026/ })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitemradio', { name: /agosto 2026/ })); });
        expect(screen.getByTestId('finanzas').textContent).toBe('nomina · 2026-08');
        expect(localStorage.getItem('finanzas.mes')).toBe('2026-08');
    });

    it('«Personalizado» arranca en el mes que se veía, toma las dos fechas y queda guardado', async () => {
        estado.puede = true;
        localStorage.setItem('finanzas.mes', '2026-08');
        const { unmount } = montar('/finanzas?s=finanzas');
        await screen.findByTestId('finanzas');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /agosto 2026/ })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitemradio', { name: 'Personalizado' })); });
        // Del 1 al 31 de agosto sigue siendo ese mes: las vistas lo reciben como mes (y se editan).
        expect(screen.getByTestId('finanzas').textContent).toBe('resumen · 2026-08');
        expect(screen.getByRole('button', { name: /01\/08(\/26)? – 31\/08/ })).toBeTruthy();

        const desde = screen.getByLabelText('Período: desde');
        await act(async () => {
            fireEvent.change(desde, { target: { value: '2026-07-16' } });
            fireEvent.blur(desde);
        });
        expect(screen.getByTestId('finanzas').textContent).toBe('resumen · 2026-07-16 → 2026-08-31');
        expect(JSON.parse(localStorage.getItem('finanzas.periodo'))).toEqual({ desde: '2026-07-16', hasta: '2026-08-31' });

        // Al volver, el rango manda sobre el mes guardado; elegir un mes lo olvida.
        unmount();
        montar('/finanzas?s=finanzas');
        expect((await screen.findByTestId('finanzas')).textContent).toBe('resumen · 2026-07-16 → 2026-08-31');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /16\/07(\/26)? – 31\/08/ })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitemradio', { name: /septiembre 2026/ })); });
        expect(screen.getByTestId('finanzas').textContent).toBe('resumen · 2026-09');
        expect(localStorage.getItem('finanzas.periodo')).toBeNull();
        expect(localStorage.getItem('finanzas.mes')).toBe('2026-09');
    });

    it('Payroll arranca en el mes en curso y cambia con su píldora de período', async () => {
        estado.puede = true;
        montar('/finanzas?s=payroll');

        const hoy = new Date();
        const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
        expect((await screen.findByTestId('payroll')).textContent).toMatch(new RegExp(`^${mes}-01 → `));

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Este mes/ })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitemradio', { name: 'Mes pasado' })); });
        const pasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const mesPasado = `${pasado.getFullYear()}-${String(pasado.getMonth() + 1).padStart(2, '0')}`;
        expect(screen.getByTestId('payroll').textContent).toMatch(new RegExp(`^${mesPasado}-01 → ${mesPasado}-`));
    });
});

describe('DashboardComercial · Payroll lleva a sus ventas en Revisar', () => {
    beforeEach(() => {
        navegar.mockClear();
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('desde /finanzas, que no tiene Revisar, abre Revisar › Ventas de Comercial con esas ventas como una sola etiqueta', async () => {
        estado.puede = true;
        const { unmount } = montar('/finanzas?s=payroll');
        const boton = await screen.findByText(/ver ventas de Andy/);
        await act(async () => { fireEvent.click(boton); });

        const destino = new URL(`http://x${navegar.mock.calls[0][0]}`);
        const q = Object.fromEntries(destino.searchParams);
        expect(destino.pathname).toBe('/admin/comercial');
        expect([q.s, q.t, q.rol, q.p]).toEqual(['revisar', 'ventas', 'closers', 'custom']);
        expect(JSON.parse(q.f)).toEqual({ __ids: [7, 9], __ids_rotulo: 'Comisión de Andy', __de: 'Comisión de Andy' });

        // Y Comercial, con esa URL, abre la lista ya filtrada.
        unmount();
        montar(destino.pathname + destino.search);
        expect(await screen.findByRole('button', { name: 'Quitar Comisión de Andy' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Ventas', selected: true })).toBeTruthy();
    });
});
