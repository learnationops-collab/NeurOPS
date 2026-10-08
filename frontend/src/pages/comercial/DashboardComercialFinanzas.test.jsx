import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * Finanzas y Payroll en el dock del dashboard comercial (08/10/2026; antes /admin/finance y
 * /admin/payroll): van juntas al final y solo para quien tiene «ver finanzas». Quién lo tiene lo
 * decide el backend (`puede_ver_finanzas` del contexto); acá se comprueba que el dock lo respete.
 */

const estado = vi.hoisted(() => ({ puede: false }));

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
vi.mock('./components/finanzas/Finanzas', async (original) => ({
    ...(await original()),
    default: ({ tab, mes }) => <div data-testid="finanzas">{`${tab} · ${mes}`}</div>,
}));
vi.mock('./components/finanzas/Payroll', async (original) => ({
    ...(await original()),
    default: ({ desde, hasta }) => <div data-testid="payroll">{`${desde} → ${hasta}`}</div>,
}));

const montar = (url = '/admin/comercial') => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial />
    </MemoryRouter>,
);

const seccionesDelDock = () => within(screen.getByRole('navigation', { name: 'Secciones del dashboard comercial' }))
    .getAllByRole('button').map(b => b.querySelector('.dock-label')?.textContent).filter(Boolean);

describe('DashboardComercial · Finanzas y Payroll', () => {
    beforeEach(() => {
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('con «ver finanzas» son las dos últimas secciones del dock, juntas', async () => {
        estado.puede = true;
        montar();
        await screen.findByTestId('analizar');

        expect(seccionesDelDock().slice(-2)).toEqual(['Finanzas', 'Payroll']);
    });

    it('sin el permiso no aparecen, y un link a Finanzas abre Analizar', async () => {
        estado.puede = false;
        montar('/admin/comercial?s=finanzas');
        await screen.findByTestId('analizar');

        expect(seccionesDelDock()).not.toContain('Finanzas');
        expect(seccionesDelDock()).not.toContain('Payroll');
        expect(screen.queryByTestId('finanzas')).toBeNull();
    });

    it('Finanzas trae sus cinco vistas arriba y su mes, que queda guardado', async () => {
        estado.puede = true;
        localStorage.setItem('finanzas.mes', '2026-09');
        montar('/admin/comercial?s=finanzas');

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

    it('Payroll arranca en el mes en curso y cambia con su píldora de período', async () => {
        estado.puede = true;
        montar('/admin/comercial?s=payroll');

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
