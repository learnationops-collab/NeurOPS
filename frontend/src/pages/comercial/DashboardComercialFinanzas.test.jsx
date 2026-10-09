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

const estado = vi.hoisted(() => ({ puede: false, user: null }));
const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => navegar }));

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: true, puede_reportar: true, puede_ver_finanzas: estado.puede,
        rol: 'closers', yo: { id: 1, rol: estado.user?.role || 'admin', nombre: 'Mario' }, miembros: [], estados: [],
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
    useAuth: () => ({ user: estado.user || { id: 1, role: 'admin', is_impersonating: false }, logout: vi.fn() }),
}));
vi.mock('./components/Analizar', () => ({ default: () => <div data-testid="analizar" /> }));
// El período que recibe Finanzas: el mes si es justo uno, y si no las dos fechas.
vi.mock('./components/finanzas/Finanzas', async (original) => ({
    ...(await original()),
    default: ({ tab, periodo }) => (
        <div data-testid="finanzas">{`${tab} · ${periodo.mes || `${periodo.desde} → ${periodo.hasta}`}`}</div>
    ),
}));
// De quién están abiertas las ventas (`ver`) lo dice la URL: el doble de Payroll lo muestra y abre o
// cierra con `onVer`, como sus tiles y su «Volver a Payroll».
vi.mock('./components/finanzas/Payroll', async (original) => ({
    ...(await original()),
    default: ({ desde, hasta, ver, onVer }) => (
        <div data-testid="payroll">
            {`${desde} → ${hasta}`}
            <output data-testid="payroll-ver">{ver || 'tiles'}</output>
            <button type="button" onClick={() => onVer('andy')}>ver ventas de Andy</button>
            <button type="button" onClick={() => onVer(null)}>volver a Payroll</button>
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

    it('Finanzas trae sus seis vistas arriba (Diferencias desde el 09/10) y su mes, que queda guardado', async () => {
        estado.puede = true;
        localStorage.setItem('finanzas.mes', '2026-09');
        montar('/finanzas?s=finanzas');

        expect((await screen.findByTestId('finanzas')).textContent).toBe('resumen · 2026-09');
        const vistas = screen.getByRole('tablist', { name: 'Vistas de Finanzas' });
        expect(within(vistas).getAllByRole('tab').map(t => t.textContent))
            .toEqual(['Resumen', 'Medios de pago', 'Anuncios', 'Nómina', 'Software', 'Diferencias']);
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

/**
 * Payroll abre las ventas de una persona dentro de /finanzas (08/10/2026): antes el tile llevaba a
 * Revisar › Ventas de /admin/comercial, la vista de la dirección. Ahora es `ver` en la URL.
 */
describe('DashboardComercial · Payroll abre las ventas de una persona sin salir de /finanzas', () => {
    beforeEach(() => {
        navegar.mockClear();
        estado.puede = true;
        estado.user = null;
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    // El «atrás» del navegador: `useNavigate` está doblado en este archivo, así que se usa el de
    // verdad, sobre el mismo historial del MemoryRouter.
    const montarConAtras = async (url) => {
        const { useNavigate: useNavigateDeVerdad } = await vi.importActual('react-router-dom');
        const Atras = () => {
            const ir = useNavigateDeVerdad();
            return <button type="button" onClick={() => ir(-1)}>atrás del navegador</button>;
        };
        return render(
            <MemoryRouter initialEntries={[url]}>
                <Routes>
                    <Route path="/finanzas" element={<DashboardComercial espacio="finanzas" />} />
                </Routes>
                <Donde />
                <Atras />
            </MemoryRouter>,
        );
    };

    it('tocar un tile deja `ver` en la URL de /finanzas, sin navegar a la dirección comercial', async () => {
        montar('/finanzas?s=payroll');
        const abrir = await screen.findByText('ver ventas de Andy');
        await act(async () => { fireEvent.click(abrir); });

        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=payroll&ver=andy');
        expect(screen.getByTestId('payroll-ver').textContent).toBe('andy');
        expect(navegar).not.toHaveBeenCalled();
        // Los filtros de grupos y personas son de los tiles: con una persona abierta no están.
        expect(screen.queryByRole('group', { name: 'Grupos de la nómina' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Todas las personas/ })).toBeNull();
        // El período y las acciones de la barra siguen.
        expect(screen.getByRole('button', { name: /Excluir ventas/ })).toBeTruthy();

        await act(async () => { fireEvent.click(screen.getByText('volver a Payroll')); });
        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=payroll');
        expect(screen.getByRole('group', { name: 'Grupos de la nómina' })).toBeTruthy();
    });

    it('el botón atrás del navegador cierra las ventas y vuelve a los tiles', async () => {
        await montarConAtras('/finanzas?s=payroll');
        const abrir = await screen.findByText('ver ventas de Andy');
        await act(async () => { fireEvent.click(abrir); });
        expect(screen.getByTestId('payroll-ver').textContent).toBe('andy');

        await act(async () => { fireEvent.click(screen.getByText('atrás del navegador')); });
        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=payroll');
        expect(screen.getByTestId('payroll-ver').textContent).toBe('tiles');
    });

    it('un link con `ver` abre esas ventas; una persona que no es de la nómina se ignora', async () => {
        const { unmount } = montar('/finanzas?s=payroll&ver=andy');
        expect((await screen.findByTestId('payroll-ver')).textContent).toBe('andy');
        unmount();

        montar('/finanzas?s=payroll&ver=nadie');
        expect((await screen.findByTestId('payroll-ver')).textContent).toBe('tiles');
        expect(screen.getByRole('group', { name: 'Grupos de la nómina' })).toBeTruthy();
    });

    it('cambiar de sección en el dock suelta las ventas abiertas', async () => {
        montar('/finanzas?s=payroll&ver=andy');
        await screen.findByTestId('payroll');
        const dock = screen.getByRole('navigation', { name: 'Secciones del dashboard comercial' });

        await act(async () => { fireEvent.click(within(dock).getByRole('button', { name: /Finanzas/ })); });
        expect(screen.getByTestId('donde').textContent).toBe('/finanzas?s=finanzas');
        await act(async () => { fireEvent.click(within(dock).getByRole('button', { name: /Payroll/ })); });
        expect(screen.getByTestId('payroll-ver').textContent).toBe('tiles');
    });
});

/** Las dos vistas se pasan de una a la otra desde el menú del avatar: ninguna queda sin salida. */
describe('DashboardComercial · ir y volver entre Comercial y Finances', () => {
    beforeEach(() => {
        navegar.mockClear();
        estado.user = null;
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    const abrirSesion = async () => {
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Tu sesión: Mario/ })); });
    };
    const opciones = () => screen.getAllByRole('menuitem').map(i => i.textContent);

    const direccion = (verFinanzas) => ({
        id: 1, role: 'director_comercial', roles: ['director_comercial'], can_view_finance: verFinanzas, is_impersonating: false,
    });

    it('en Comercial, con «ver finanzas», el menú ofrece el hub y «Pasar a Finances»', async () => {
        estado.puede = true;
        estado.user = direccion(true);
        montar();
        await screen.findByTestId('analizar');

        await abrirSesion();
        expect(screen.getByText('Dirección comercial')).toBeTruthy();
        expect(opciones()).toEqual(['Cambiar de área', 'Cambiar de vista', 'Pasar a Finances', 'Simular a un closer',
            'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Pasar a Finances' }));
        expect(navegar).toHaveBeenCalledWith('/finanzas');
    });

    it('en Comercial, sin «ver finanzas» y con un solo rol, no ofrece ni Finances ni el hub', async () => {
        estado.puede = false;
        estado.user = direccion(false);
        montar();
        await screen.findByTestId('analizar');

        await abrirSesion();
        expect(opciones()).toEqual(['Cambiar de área', 'Simular a un closer', 'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);
    });

    it('en /finanzas el menú dice Finances y ofrece volver a la dirección comercial', async () => {
        estado.puede = true;
        estado.user = direccion(true);
        montar('/finanzas');
        await screen.findByTestId('finanzas');

        await abrirSesion();
        expect(screen.getByText('Finances')).toBeTruthy();
        expect(opciones()).toEqual(['Cambiar de área', 'Pasar a Dirección comercial', 'Cambiar de vista', 'Simular a un closer',
            'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Pasar a Dirección comercial' }));
        expect(navegar).toHaveBeenCalledWith('/admin/comercial');
    });

    it('«Cambiar de vista» lleva al hub de vistas, en Comercial y en /finanzas', async () => {
        estado.puede = true;
        estado.user = direccion(true);
        const { unmount } = montar();
        await screen.findByTestId('analizar');
        await abrirSesion();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Cambiar de vista' }));
        expect(navegar).toHaveBeenLastCalledWith('/vistas');

        unmount();
        montar('/finanzas');
        await screen.findByTestId('finanzas');
        await abrirSesion();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Cambiar de vista' }));
        expect(navegar).toHaveBeenLastCalledWith('/vistas');
    });

    it('el admin vuelve de /finanzas a su pantalla, y sus otros roles siguen en el menú', async () => {
        estado.puede = true;
        estado.user = { id: 1, role: 'admin', roles: ['admin', 'closer'], can_view_finance: true, is_impersonating: false };
        montar('/finanzas');
        await screen.findByTestId('finanzas');

        await abrirSesion();
        expect(opciones().slice(0, 4)).toEqual(['Cambiar de área', 'Pasar a Administrador', 'Cambiar de vista', 'Cambiar de rol']);
        expect(opciones()).not.toContain('Pasar a Finances');
        fireEvent.click(screen.getByRole('menuitem', { name: 'Pasar a Administrador' }));
        expect(navegar).toHaveBeenCalledWith('/admin/ventas');
    });
});
