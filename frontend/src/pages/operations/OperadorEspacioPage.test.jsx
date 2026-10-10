import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OperadorEspacioPage from './OperadorEspacioPage';
import OpsRuta from './OpsRuta';

/**
 * El espacio del operador: pestañas arriba y UN dock abajo, como el espacio del setter. Las
 * pantallas que monta se reemplazan por dobles: acá se prueba la navegación, no su contenido.
 */

const sesion = vi.hoisted(() => ({ user: null }));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: sesion.user, logout: vi.fn() }),
}));
vi.mock('../../contexts/PlaybookContext', () => ({
    usePlaybook: () => ({ pendingCount: 0, openPlaybook: vi.fn() }),
}));
vi.mock('../../utils/impersonation', () => ({ revertImpersonation: vi.fn() }));
vi.mock('../../components/MainLayout', () => ({ default: ({ children }) => <div data-testid="main-layout">{children}</div> }));
vi.mock('./settings/SeccionTecnica', () => ({
    default: ({ id }) => <div data-testid="seccion">{id}</div>,
    ETIQUETAS_TECNICAS: {
        team: 'Gestión de Equipo', closer_aliases: 'Alias de Closers', leads_audit: 'Auditoría de Leads',
        report_backlog: 'Bloqueo del Reporte', bug_reports: 'Reportes de Bugs', playbook: 'Playbook',
        bitacora: 'Bitácora de Cambios', marketing: 'Marketing UTMs', database: 'Base de Datos',
        operations: 'Operaciones Críticas', infra: 'Infraestructura', danger_zone: 'Zona de Peligro',
    },
}));
vi.mock('../admin/reports/FinancialAgendasPage', () => ({ default: () => <div data-testid="agendas" /> }));
vi.mock('../public/PublicFinancialSalesPage', () => ({ default: () => <div data-testid="ventas" /> }));
vi.mock('../shared/FormsManagementPage', () => ({ default: () => <div data-testid="formularios" /> }));
vi.mock('./course-editor/CourseEditorPage', () => ({ default: () => <div data-testid="curso" /> }));

const Ubicacion = () => {
    const { pathname, search } = useLocation();
    return <output data-testid="url">{pathname + search}</output>;
};

const montar = (url) => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/ops/dashboard" element={<OpsRuta><div data-testid="legacy-dashboard" /></OpsRuta>} />
            <Route path="/ops/agendas" element={<OpsRuta paso="agendas"><div data-testid="legacy-agendas" /></OpsRuta>} />
            <Route path="/ops/ventas" element={<OpsRuta paso="ventas"><div data-testid="legacy-ventas" /></OpsRuta>} />
        </Routes>
        <Ubicacion />
    </MemoryRouter>,
);

describe('Espacio del operador', () => {
    beforeEach(() => {
        sesion.user = { id: 3, role: 'operator', roles: ['operator', 'closer'], username: 'Mario Bühler' };
    });

    it('arranca en Equipo y el dock trae las seis secciones', () => {
        montar('/ops/dashboard');

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Equipo');
        expect(screen.getByTestId('seccion')).toHaveTextContent('team');
        const dock = screen.getByRole('navigation', { name: 'Secciones del espacio del operador' });
        ['Equipo', 'Soporte', 'Datos', 'Agendas', 'Ventas', 'Formularios', 'Curso'].forEach(etiqueta => {
            expect(dock).toHaveTextContent(etiqueta);
        });
    });

    it('Soporte reparte sus secciones en pestañas, no en un menú vertical', () => {
        montar('/ops/dashboard?step=soporte');

        const pestanas = screen.getByRole('tablist', { name: 'Vistas de Soporte' });
        expect(pestanas).toHaveTextContent('Reportes de Bugs');
        expect(pestanas).toHaveTextContent('Alias de Closers');
        expect(screen.getByTestId('seccion')).toHaveTextContent('bug_reports');

        fireEvent.click(screen.getByRole('tab', { name: 'Bitácora de Cambios' }));

        expect(screen.getByTestId('seccion')).toHaveTextContent('bitacora');
        expect(screen.getByTestId('url')).toHaveTextContent('step=soporte&tab=bitacora');
    });

    it('Datos trae la zona de peligro como una pestaña más', () => {
        montar('/ops/dashboard?step=datos&tab=danger_zone');

        expect(screen.getByRole('tab', { name: 'Zona de Peligro' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('seccion')).toHaveTextContent('danger_zone');
    });

    it('elegir una sección en el dock cambia el paso en la URL', () => {
        montar('/ops/dashboard');

        fireEvent.click(screen.getByRole('button', { name: /Ventas/ }));

        expect(screen.getByTestId('url')).toHaveTextContent('/ops/dashboard?step=ventas');
        expect(screen.getByTestId('ventas')).toBeInTheDocument();
    });

    it('Formularios, que era de «Administración», es una sección más (10/10/2026)', () => {
        montar('/ops/dashboard?step=formularios');

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Formularios');
        expect(screen.getByTestId('formularios')).toBeInTheDocument();
    });

    it('un paso o una pestaña que no existen caen en los de siempre', () => {
        montar('/ops/dashboard?step=nada&tab=tampoco');

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Equipo');
    });

    it('el menú del avatar lleva al Portal, donde están sus otros roles y Simular', async () => {
        montar('/ops/dashboard');

        fireEvent.click(screen.getByRole('button', { name: /Mario/ }));

        expect(screen.getByRole('menuitem', { name: /^Portal/ })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Simular/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Cambiar de rol/ })).not.toBeInTheDocument();
    });

    it('las rutas viejas mandan al operador a su sección del espacio', () => {
        montar('/ops/agendas');

        expect(screen.getByTestId('url')).toHaveTextContent('/ops/dashboard?step=agendas');
        expect(screen.queryByTestId('legacy-agendas')).not.toBeInTheDocument();
    });
});

describe('OpsRuta: el admin entra al mismo espacio (10/10/2026)', () => {
    it('sin el layout de la app, y las rutas viejas lo llevan a su sección', () => {
        sesion.user = { id: 1, role: 'admin', roles: ['admin'] };

        montar('/ops/ventas');

        expect(screen.queryByTestId('main-layout')).not.toBeInTheDocument();
        expect(screen.getByTestId('url')).toHaveTextContent('/ops/dashboard?step=ventas');
        expect(screen.getByTestId('ventas')).toBeInTheDocument();
    });
});
