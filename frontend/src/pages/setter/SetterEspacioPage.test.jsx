import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterEspacioPage from './SetterEspacioPage';

/**
 * El espacio del setter tiene UN dock, y entrar a "Mis datos" no lo cambia.
 *
 * Reportado el 29/sep/2026 simulando a un setter: al ir a "Mis datos" el panel de abajo pasaba a
 * ser el del dashboard comercial (Analizar, Revisar, Proyectar...) y ya no había cómo volver a
 * Cualificación; la única salida era "Volver a mi sesión", que terminaba la simulación.
 *
 * Las secciones se reemplazan por dobles: acá se prueba la navegación del espacio, no las
 * pantallas que monta. El doble del dashboard dice si el host le dio a dónde llevar un
 * drill-down (`onIrASeccion`): el setter no ve Revisar, así que no tiene que dárselo.
 */

const sesion = vi.hoisted(() => ({ user: null, reportesHoy: 0 }));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: sesion.user, logout: vi.fn() }),
}));
vi.mock('../../contexts/PlaybookContext', () => ({
    usePlaybook: () => ({ pendingCount: 0, openPlaybook: vi.fn() }),
}));
vi.mock('../../services/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: { total: sesion.reportesHoy } })) },
}));
vi.mock('../../utils/impersonation', () => ({ revertImpersonation: vi.fn() }));
vi.mock('../../components/modals/OperatorControls', () => ({ default: () => null }));
vi.mock('./SetterWorkflowPage', () => ({
    default: ({ paso }) => <div data-testid="mazo">mazo:{paso}</div>,
}));
vi.mock('./agendas/SetterAgendasPage', () => ({ default: () => <div data-testid="agendas-historial" /> }));
vi.mock('../public/PublicSetterReportPage', () => ({ default: () => <div data-testid="reporte-hoy" /> }));
vi.mock('../public/PublicSetterStatsPage', () => ({
    default: ({ embebido }) => <div data-testid="mis-reportes">{embebido ? 'embebido' : 'pagina'}</div>,
}));
vi.mock('../comercial/DashboardComercial', () => ({
    default: ({ seccionFija, onIrASeccion }) => (
        <div data-testid={`dashboard-${seccionFija}`}>{onIrASeccion ? 'con drill-down' : 'sin drill-down'}</div>
    ),
}));

const Ubicacion = () => {
    const { search } = useLocation();
    return <output data-testid="url">{search}</output>;
};

/** Monta en `url` y deja resolver la consulta del reporte de hoy (el ✓ del dock). */
const montar = async (url) => {
    const vista = render(
        <MemoryRouter initialEntries={[url]}>
            <SetterEspacioPage />
            <Ubicacion />
        </MemoryRouter>,
    );
    await act(async () => {});
    return vista;
};

const dock = () => screen.getByRole('navigation', { name: 'Secciones del espacio del setter' });
const itemDelDock = (nombre) => screen.getAllByRole('button', { name: new RegExp(`^${nombre}`) })
    .find(b => dock().contains(b));
const url = () => new URLSearchParams(screen.getByTestId('url').textContent);

describe('SetterEspacioPage · un solo dock', () => {
    beforeEach(() => {
        sesion.user = { id: 7, name: 'Ana Setter', role: 'setter', is_impersonating: true };
        sesion.reportesHoy = 0;
        // jsdom no implementa el scroll; cambiar de sección vuelve arriba de la página.
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('en "Mis datos" el dock sigue siendo el del setter, y vuelve al trabajo', async () => {
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('dashboard-analizar')).toBeInTheDocument();
        const secciones = Array.from(dock().querySelectorAll('.dock-item')).map(b => b.getAttribute('aria-label'));
        expect(secciones).toEqual(['Cualificación', 'Agendas', 'Reporte', 'Mis datos']);
        expect(itemDelDock('Mis datos')).toHaveAttribute('aria-current', 'page');

        // Simulando, "Volver a mi sesión" está, pero ya no es la única salida.
        expect(screen.getByRole('button', { name: /Volver a mi sesión/ })).toBeInTheDocument();

        fireEvent.click(itemDelDock('Cualificación'));
        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:cualificacion');
        expect(itemDelDock('Cualificación')).toHaveAttribute('aria-current', 'page');
        expect(url().get('step')).toBe('cualificacion');
    });

    it('el setter no ve Revisar, y "Mis datos" va sin drill-down', async () => {
        // Pedido del 29/09/2026: Revisar no le hace falta al setter. Sin a dónde llevar un dato,
        // el dashboard muestra los números sin flechas que no lleven a ningún lado.
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('dashboard-analizar')).toHaveTextContent('sin drill-down');
        expect(screen.queryAllByRole('button', { name: /^Revisar/ })).toHaveLength(0);
    });

    it('un link viejo a Revisar abre Cualificación, no una pantalla vacía', async () => {
        await montar('/setter/deck?step=revisar');

        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:cualificacion');
        expect(screen.queryByTestId('dashboard-revisar')).toBeNull();
    });

    it('las rutas viejas caen en su sección y pestaña', async () => {
        // /setter/statistics redirige a esta URL (ver App.jsx).
        await montar('/setter/deck?step=reporte&tab=historial');

        expect(screen.getByTestId('mis-reportes')).toHaveTextContent('embebido');
        expect(screen.getByRole('tab', { name: 'Mis reportes' })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByRole('tab', { name: 'Reporte del día' }));
        expect(screen.getByTestId('reporte-hoy')).toBeInTheDocument();
        expect(url().get('tab')).toBe('hoy');
    });

    it('una sección o pestaña desconocida cae en la primera, no en una pantalla vacía', async () => {
        await montar('/setter/deck?step=inventada&tab=otra');

        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:cualificacion');
        expect(itemDelDock('Cualificación')).toHaveAttribute('aria-current', 'page');
    });

    it('Cualificación y Agendas por fecha comparten el mazo, sin desmontarlo', async () => {
        await montar('/setter/deck?step=cualificacion');
        const mazo = screen.getByTestId('mazo');

        fireEvent.click(itemDelDock('Agendas'));

        // Es el MISMO nodo: si React lo desmontara, el rango de fechas y la búsqueda se perderían.
        expect(screen.getByTestId('mazo')).toBe(mazo);
        expect(mazo).toHaveTextContent('mazo:agendas');
    });

    it('con el reporte de hoy enviado, el dock lo marca', async () => {
        sesion.reportesHoy = 1;
        await montar('/setter/deck?step=cualificacion');

        expect(itemDelDock('Reporte')).toHaveAttribute('aria-label', 'Reporte, reporte de hoy enviado');
    });

    it('sin simulación no ofrece "Volver a mi sesión"', async () => {
        sesion.user = { ...sesion.user, is_impersonating: false };
        await montar('/setter/deck?step=datos');

        expect(screen.queryByRole('button', { name: /Volver a mi sesión/ })).toBeNull();
    });
});
