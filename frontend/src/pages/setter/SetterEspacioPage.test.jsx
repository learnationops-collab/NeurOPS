import React from 'react';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterEspacioPage from './SetterEspacioPage';

/**
 * El espacio del setter tiene UN dock, y entrar a "Mis datos" no lo cambia.
 *
 * Reportado el 29/sep/2026 simulando a un setter: al ir a "Mis datos" el panel de abajo pasaba a
 * ser el del dashboard comercial (Analizar, Revisar, Proyectar...) y ya no había cómo volver al
 * trabajo; la única salida era "Volver a mi sesión", que terminaba la simulación.
 *
 * Las secciones se reemplazan por dobles: acá se prueba la navegación del espacio, no las
 * pantallas que monta. El doble del dashboard hace lo mismo que el real en el drill-down: escribe
 * la tabla y el filtro en la URL y, en el MISMO clic, le pide al host ir a la lista con la query
 * string que acaba de escribir. Montado como lista (`seccionFija="revisar"`), dice qué tabla y qué
 * filtro le llegaron por la URL.
 */

const sesion = vi.hoisted(() => ({ user: null, reportesHoy: 0, pendientes: 0, openPlaybook: null }));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: sesion.user, logout: vi.fn() }),
}));
vi.mock('../../contexts/PlaybookContext', () => ({
    usePlaybook: () => ({ pendingCount: sesion.pendientes, openPlaybook: sesion.openPlaybook }),
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
    default: function DashboardDoble({ seccionFija, onIrASeccion }) {
        const [params, setParams] = useSearchParams();
        const drillDown = () => {
            const siguiente = new URLSearchParams(params);
            siguiente.set('t', 'generadas');
            siguiente.set('f', '{"asistio":"Sí"}');
            siguiente.set('ft', '1');
            setParams(siguiente, { replace: true });
            onIrASeccion?.('revisar', siguiente);
        };
        return (
            <div data-testid={`dashboard-${seccionFija}`}>
                {onIrASeccion ? 'con drill-down' : 'sin drill-down'}
                {onIrASeccion && <button type="button" onClick={drillDown}>ver el detalle</button>}
                {seccionFija === 'revisar' && (
                    <output data-testid="lista">{`${params.get('t') || 'leads'} · ${params.get('f') || 'sin filtro'}`}</output>
                )}
            </div>
        );
    },
}));

const Ubicacion = () => {
    const { search } = useLocation();
    return <output data-testid="url">{search}</output>;
};

/** El "atrás" del navegador. */
const Atras = () => {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(-1)}>atrás</button>;
};

/** Monta en `url` y deja resolver la consulta del reporte de hoy (el ✓ del dock). */
const montar = async (url) => {
    const vista = render(
        <MemoryRouter initialEntries={[url]}>
            <SetterEspacioPage />
            <Ubicacion />
            <Atras />
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
        sesion.pendientes = 0;
        sesion.openPlaybook = vi.fn();
        // jsdom no implementa el scroll; cambiar de sección vuelve arriba de la página.
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('en "Mis datos" el dock sigue siendo el del setter, y vuelve al trabajo', async () => {
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('dashboard-analizar')).toBeInTheDocument();
        const secciones = Array.from(dock().querySelectorAll('.dock-item')).map(b => b.getAttribute('aria-label'));
        expect(secciones).toEqual(['Mis agendas', 'Reporte', 'Mis datos']);
        expect(itemDelDock('Mis datos')).toHaveAttribute('aria-current', 'page');

        // Simulando, "Volver a mi sesión" está, pero ya no es la única salida.
        expect(screen.getByRole('button', { name: /Volver a mi sesión/ })).toBeInTheDocument();

        fireEvent.click(itemDelDock('Mis agendas'));
        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:agendas');
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
        expect(url().get('step')).toBe('agendas');
    });

    it('el setter no ve Revisar, pero "Mis datos" tiene a dónde llevar un número', async () => {
        // Pedido del 29/09/2026: Revisar no le hace falta al setter. Desde el 01/10/2026 sus
        // listas están en Reporte · Registros, y ahí lleva el drill-down.
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('dashboard-analizar')).toHaveTextContent('con drill-down');
        expect(screen.queryAllByRole('button', { name: /^Revisar/ })).toHaveLength(0);
    });

    it('un link viejo a Revisar abre Mis agendas, no una pantalla vacía', async () => {
        await montar('/setter/deck?step=revisar');

        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:agendas');
        expect(screen.queryByTestId('dashboard-revisar')).toBeNull();
    });

    it('Reporte tiene sus Registros: la lista del dashboard, en una pestaña más', async () => {
        await montar('/setter/deck?step=reporte&tab=registros');

        // Abierta a mano, sin un número detrás: sus leads, sin filtro.
        expect(screen.getByTestId('lista')).toHaveTextContent('leads · sin filtro');
        expect(screen.getAllByRole('tab').map(t => t.textContent))
            .toEqual(['Reporte del día', 'Mis reportes', 'Registros']);
        expect(screen.getByRole('tab', { name: 'Registros' })).toHaveAttribute('aria-selected', 'true');
        expect(itemDelDock('Reporte')).toHaveAttribute('aria-current', 'page');
    });

    it('un número de "Mis datos" abre Registros con su tabla y su filtro, en el mismo clic', async () => {
        await montar('/setter/deck?step=datos&p=mes');

        fireEvent.click(screen.getByRole('button', { name: 'ver el detalle' }));

        // Las dos navegaciones del clic —la del dashboard (`t`, `f`, `ft`) y la del espacio
        // (`step`, `tab`)— sobreviven: la segunda parte de la URL que escribió la primera.
        expect(url().get('step')).toBe('reporte');
        expect(url().get('tab')).toBe('registros');
        expect(url().get('t')).toBe('generadas');
        expect(url().get('f')).toBe('{"asistio":"Sí"}');
        expect(url().get('ft')).toBe('1');
        expect(url().get('p')).toBe('mes');
        expect(screen.getByTestId('lista')).toHaveTextContent('generadas · {"asistio":"Sí"}');
        expect(screen.getByRole('tab', { name: 'Registros' })).toHaveAttribute('aria-selected', 'true');
        expect(itemDelDock('Reporte')).toHaveAttribute('aria-current', 'page');
    });

    it('"atrás" desde la lista vuelve a "Mis datos"', async () => {
        await montar('/setter/deck?step=datos&p=mes');
        fireEvent.click(screen.getByRole('button', { name: 'ver el detalle' }));
        expect(screen.getByTestId('dashboard-revisar')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'atrás' }));

        expect(screen.getByTestId('dashboard-analizar')).toBeInTheDocument();
        expect(url().get('step')).toBe('datos');
        expect(url().get('p')).toBe('mes');
    });

    it('volver a Registros por el dock suelta el filtro del último número', async () => {
        // Tocó un número, volvió a "Mis datos" y después entra a Registros por su cuenta: la lista
        // no tiene que resucitar aquel filtro.
        await montar('/setter/deck?step=datos&p=mes&t=generadas&f=%7B%22asistio%22%3A%22S%C3%AD%22%7D&ft=3');

        fireEvent.click(itemDelDock('Reporte'));
        fireEvent.click(screen.getByRole('tab', { name: 'Registros' }));

        expect(screen.getByTestId('lista')).toHaveTextContent('leads · sin filtro');
        expect(url().get('t')).toBeNull();
        expect(url().get('f')).toBeNull();
        expect(url().get('ft')).toBeNull();
        expect(url().get('p')).toBe('mes');
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

        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:agendas');
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
    });

    it('Cualificación ya no está: el aterrizaje viejo cae en Mis agendas', async () => {
        // Pedido del 10/10/2026: "quitar la pestaña de cualificación, ya no es necesario para los
        // setters". Un link guardado con `?step=cualificacion` no puede abrir una pantalla vacía.
        await montar('/setter/deck?step=cualificacion');

        expect(screen.getByTestId('mazo')).toHaveTextContent('mazo:agendas');
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
        expect(screen.queryAllByRole('button', { name: /^Cualificación/ })).toHaveLength(0);
    });

    it('con el reporte de hoy enviado, el dock lo marca', async () => {
        sesion.reportesHoy = 1;
        await montar('/setter/deck?step=agendas');

        expect(itemDelDock('Reporte')).toHaveAttribute('aria-label', 'Reporte, reporte de hoy enviado');
    });

    it('el encabezado es una línea: el número de la sección, el saludo y las pestañas', async () => {
        // El estilo del reporte que aprobó Kerwin (10/10/2026): "01" es el número de la sección en
        // el dock, el saludo va con el nombre de pila y las pestañas, en la misma línea.
        await montar('/setter/deck?step=agendas');
        const header = document.querySelector('header.tope');
        expect(header.querySelector('.head-num')).toHaveTextContent('01');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hola, Ana.');
        expect(screen.queryByRole('tablist')).toBeNull();

        fireEvent.click(itemDelDock('Reporte'));
        expect(header.contains(screen.getByRole('tablist', { name: 'Vistas de Reporte' }))).toBe(true);
    });

    it('sin simulación no ofrece "Volver a mi sesión"', async () => {
        sesion.user = { ...sesion.user, is_impersonating: false };
        await montar('/setter/deck?step=datos');

        expect(screen.queryByRole('button', { name: /Volver a mi sesión/ })).toBeNull();
    });
});

/**
 * La sesión al final del dock (30/09/2026), como en el mazo del closer: el Playbook, quién está
 * conectado y cerrar sesión ya no son botones del header. Simulando, "Volver a mi sesión" sigue
 * a la vista arriba y además está en el menú.
 */
describe('SetterEspacioPage · la sesión en el dock', () => {
    beforeEach(() => {
        sesion.user = { id: 7, name: 'Ana Setter', role: 'setter', is_impersonating: false };
        sesion.reportesHoy = 0;
        sesion.pendientes = 3;
        sesion.openPlaybook = vi.fn();
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    const abrirSesion = async (nombre) => {
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: nombre })); });
    };

    it('el header ya no tiene Playbook ni cerrar sesión: están en el avatar del dock, con lo pendiente a la vista', async () => {
        await montar('/setter/deck?step=agendas');

        const header = document.querySelector('header.tope');
        expect(header.querySelectorAll('button')).toHaveLength(0);
        const avatar = screen.getByRole('button', { name: 'Tu sesión: Ana Setter, 3 videos pendientes del Playbook' });
        expect(dock().contains(avatar)).toBe(true);
        expect(avatar.querySelector('.dock-sesion-aviso')).toHaveTextContent('3');

        await abrirSesion('Tu sesión: Ana Setter, 3 videos pendientes del Playbook');
        expect(screen.getByText('Setter')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem').map(i => i.getAttribute('aria-label') || i.textContent))
            .toEqual(['Playbook, 3 pendientes', 'Mis links de agendamiento', 'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);

        fireEvent.click(screen.getByRole('menuitem', { name: 'Playbook, 3 pendientes' }));
        expect(sesion.openPlaybook).toHaveBeenCalledWith('pending');
    });

    it('simulando, "Volver a mi sesión" está arriba y también en el menú', async () => {
        sesion.user = { ...sesion.user, is_impersonating: true };
        sesion.pendientes = 0;
        await montar('/setter/deck?step=agendas');

        const header = document.querySelector('header.tope');
        expect(Array.from(header.querySelectorAll('button')).map(b => b.textContent)).toEqual(['Volver a mi sesión']);

        await abrirSesion('Tu sesión: Ana Setter');
        expect(screen.getByText('Setter · simulación')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem').map(i => i.getAttribute('aria-label') || i.textContent))
            .toEqual(['Playbook', 'Mis links de agendamiento', 'Reportar un problema', 'Mis reportes', 'Volver a mi sesión', 'Cerrar sesión']);
    });
});
