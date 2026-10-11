import React from 'react';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterEspacioPage from './SetterEspacioPage';
import api from '../../services/api';

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
 * string que acaba de escribir. Montado como lista (`seccionFija="revisar"`), dice qué tabla le
 * fijó el espacio (`tablaFija`) y qué filtro le llegó por la URL.
 */

const sesion = vi.hoisted(() => ({ user: null, reportesHoy: 0, pendientes: 0, openPlaybook: null, pendientesAgendas: 0 }));

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
// La bandeja de "Mis agendas" le informa al espacio cuántas quedan (la marca del dock).
vi.mock('./agendas/MisAgendas', () => ({
    default: function MisAgendasDoble({ onResumen }) {
        React.useEffect(() => { onResumen?.({ pendientes: sesion.pendientesAgendas, hoy: 0, racha: 0 }); }, []);
        return <div data-testid="mis-agendas" />;
    },
}));
vi.mock('./reporte/ReporteDiario', () => ({
    default: ({ setterId }) => <div data-testid="reporte-hoy">reporte de {setterId}</div>,
}));
vi.mock('./reporte/Historial', () => ({
    default: ({ setterId }) => <div data-testid="mis-reportes">historial de {setterId}</div>,
}));
vi.mock('../comercial/DashboardComercial', () => ({
    default: function DashboardDoble({ seccionFija, onIrASeccion, tablaFija }) {
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
                    <output data-testid="lista">{`${tablaFija} · ${params.get('f') || 'sin filtro'}`}</output>
                )}
            </div>
        );
    },
}));

// «Mis datos» (10/10/2026) es su propia vista: el doble hace lo que la real en el drill-down, arma la
// URL con la tabla y el filtro y se la pasa al host en el mismo clic (sin escribirla ella).
vi.mock('./datos/SetterDatos', () => ({
    default: function DatosDoble({ tab, onIrALista }) {
        const [params] = useSearchParams();
        const drillDown = () => {
            const siguiente = new URLSearchParams(params);
            siguiente.set('t', 'generadas');
            siguiente.set('f', '{"asistio":"Sí"}');
            siguiente.set('ft', '1');
            onIrALista?.('generadas', siguiente);
        };
        return (
            <div data-testid={`datos-${tab}`}>
                {onIrALista ? 'con drill-down' : 'sin drill-down'}
                {onIrALista && <button type="button" onClick={drillDown}>ver el detalle</button>}
            </div>
        );
    },
}));

const Ubicacion = () => {
    const { pathname, search } = useLocation();
    return <><output data-testid="url">{search}</output><output data-testid="ruta">{pathname}</output></>;
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
        sesion.pendientesAgendas = 0;
        sesion.pendientes = 0;
        sesion.openPlaybook = vi.fn();
        // jsdom no implementa el scroll; cambiar de sección vuelve arriba de la página.
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('en "Mis datos" el dock sigue siendo el del setter, y vuelve al trabajo', async () => {
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('datos-resumen')).toBeInTheDocument();
        const secciones = Array.from(dock().querySelectorAll('.dock-item')).map(b => b.getAttribute('aria-label'));
        expect(secciones).toEqual(['Mis agendas', 'Revisar', 'Reporte', 'Mis datos']);
        expect(itemDelDock('Mis datos')).toHaveAttribute('aria-current', 'page');

        // Simulando, "Volver a mi sesión" está, pero ya no es la única salida.
        expect(screen.getByRole('button', { name: /Volver a mi sesión/ })).toBeInTheDocument();

        fireEvent.click(itemDelDock('Mis agendas'));
        expect(screen.getByTestId('mis-agendas')).toBeInTheDocument();
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
        expect(url().get('step')).toBe('agendas');
    });

    it('"Mis datos" tiene a dónde llevar un número', async () => {
        await montar('/setter/deck?step=datos');

        expect(screen.getByTestId('datos-resumen')).toHaveTextContent('con drill-down');
    });

    it('"Mis datos" tiene dos pestañas: sus datos y Comparativas', async () => {
        // Pedido del 10/10/2026: «permitir que los setters vean la pestaña de comparativas».
        await montar('/setter/deck?step=datos&p=7d');

        expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Mis datos', 'Comparativas']);
        expect(screen.getByRole('tab', { name: 'Mis datos' })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByRole('tab', { name: 'Comparativas' }));

        expect(screen.getByTestId('datos-comparativas')).toBeInTheDocument();
        expect(url().get('tab')).toBe('comparativas');
        // El período es el mismo para las dos pestañas.
        expect(url().get('p')).toBe('7d');
    });

    it('Revisar es una sección del setter, con Agendas · Ventas · Leads (10/10/2026)', async () => {
        // Revierte el 29/09 (el setter no veía Revisar) y el 01/10 (sus listas en Reporte ·
        // Registros). Abierta a mano, sin un número detrás: sus agendas, sin filtro.
        await montar('/setter/deck?step=revisar');

        expect(itemDelDock('Revisar')).toHaveAttribute('aria-current', 'page');
        expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Agendas', 'Ventas', 'Leads']);
        expect(screen.getByRole('tab', { name: 'Agendas' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('lista')).toHaveTextContent('generadas · sin filtro');
    });

    it('cada pestaña de Revisar le fija su tabla al dashboard, sin desmontarlo', async () => {
        await montar('/setter/deck?step=revisar');
        const lista = screen.getByTestId('dashboard-revisar');

        fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }));
        expect(screen.getByTestId('lista')).toHaveTextContent('ventas · sin filtro');
        expect(url().get('tab')).toBe('ventas');

        fireEvent.click(screen.getByRole('tab', { name: 'Leads' }));
        expect(screen.getByTestId('lista')).toHaveTextContent('leads · sin filtro');
        // El mismo dashboard: desmontarlo volvía a pedir el contexto en cada pestaña.
        expect(screen.getByTestId('dashboard-revisar')).toBe(lista);
    });

    it('Reporte ya no tiene Registros, y un link viejo cae en su primera pestaña', async () => {
        await montar('/setter/deck?step=reporte&tab=registros');

        expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Reporte', 'Historial']);
        expect(screen.getByTestId('reporte-hoy')).toBeInTheDocument();
        expect(screen.queryByTestId('dashboard-revisar')).toBeNull();
    });

    it('un número de "Mis datos" abre Revisar en la pestaña de su tabla, con su filtro, en el mismo clic', async () => {
        await montar('/setter/deck?step=datos&p=mes');
        expect(screen.getByTestId('datos-resumen')).toHaveTextContent('con drill-down');

        fireEvent.click(screen.getByRole('button', { name: 'ver el detalle' }));

        // Las dos partes del clic —la tabla y el filtro que arma «Mis datos» (`t`, `f`, `ft`) y la
        // sección del espacio (`step`, `tab`)— quedan en la URL, con el período.
        expect(url().get('step')).toBe('revisar');
        expect(url().get('tab')).toBe('agendas');
        expect(url().get('t')).toBe('generadas');
        expect(url().get('f')).toBe('{"asistio":"Sí"}');
        expect(url().get('ft')).toBe('1');
        expect(url().get('p')).toBe('mes');
        expect(screen.getByTestId('lista')).toHaveTextContent('generadas · {"asistio":"Sí"}');
        expect(screen.getByRole('tab', { name: 'Agendas' })).toHaveAttribute('aria-selected', 'true');
        expect(itemDelDock('Revisar')).toHaveAttribute('aria-current', 'page');
    });

    it('"atrás" desde la lista vuelve a "Mis datos"', async () => {
        await montar('/setter/deck?step=datos&p=mes');
        fireEvent.click(screen.getByRole('button', { name: 'ver el detalle' }));
        expect(url().get('step')).toBe('revisar');

        fireEvent.click(screen.getByRole('button', { name: 'atrás' }));

        expect(screen.getByTestId('datos-resumen')).toBeInTheDocument();
        expect(url().get('step')).toBe('datos');
        expect(url().get('p')).toBe('mes');
    });

    it('volver a Revisar por el dock suelta el filtro del último número', async () => {
        // Tocó un número, volvió a "Mis datos" y después entra a Revisar por su cuenta: la lista
        // no tiene que resucitar aquel filtro.
        await montar('/setter/deck?step=datos&p=mes&t=generadas&f=%7B%22asistio%22%3A%22S%C3%AD%22%7D&ft=3');

        fireEvent.click(itemDelDock('Revisar'));

        expect(screen.getByTestId('lista')).toHaveTextContent('generadas · sin filtro');
        expect(url().get('t')).toBeNull();
        expect(url().get('f')).toBeNull();
        expect(url().get('ft')).toBeNull();
        expect(url().get('p')).toBe('mes');
    });

    it('las rutas viejas caen en su sección y pestaña', async () => {
        // /setter/statistics redirige a esta URL (ver App.jsx).
        await montar('/setter/deck?step=reporte&tab=historial');

        // El Historial y el reporte son los del setter de la sesión (simulando, el simulado).
        expect(screen.getByTestId('mis-reportes')).toHaveTextContent('historial de 7');
        expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByRole('tab', { name: 'Reporte' }));
        expect(screen.getByTestId('reporte-hoy')).toHaveTextContent('reporte de 7');
        expect(url().get('tab')).toBe('hoy');
    });

    it('una sección o pestaña desconocida cae en la primera, no en una pantalla vacía', async () => {
        await montar('/setter/deck?step=inventada&tab=otra');

        expect(screen.getByTestId('mis-agendas')).toBeInTheDocument();
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
    });

    it('Cualificación ya no está: el aterrizaje viejo cae en Mis agendas', async () => {
        // Pedido del 10/10/2026: "quitar la pestaña de cualificación, ya no es necesario para los
        // setters". Un link guardado con `?step=cualificacion` no puede abrir una pantalla vacía.
        await montar('/setter/deck?step=cualificacion');

        expect(screen.getByTestId('mis-agendas')).toBeInTheDocument();
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-current', 'page');
        expect(screen.queryAllByRole('button', { name: /^Cualificación/ })).toHaveLength(0);
    });

    it('el dock dice cuántas agendas quedan sin palabra clave', async () => {
        sesion.pendientesAgendas = 12;
        await montar('/setter/deck?step=agendas');
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-label', 'Mis agendas, 12 sin palabra clave');
        expect(itemDelDock('Mis agendas').querySelector('.dock-marca--cuenta')).toHaveTextContent('12');
    });

    it('con la bandeja vacía, el dock marca "Mis agendas" con ✓', async () => {
        sesion.pendientesAgendas = 0;
        await montar('/setter/deck?step=agendas');
        expect(itemDelDock('Mis agendas')).toHaveAttribute('aria-label', 'Mis agendas, todas con palabra clave');
    });

    it('con el reporte de hoy enviado, el dock lo marca', async () => {
        sesion.reportesHoy = 1;
        await montar('/setter/deck?step=agendas');

        expect(itemDelDock('Reporte')).toHaveAttribute('aria-label', 'Reporte, reporte de hoy enviado');
    });

    it('Revisar es la 02 del encabezado, con su frase', async () => {
        await montar('/setter/deck?step=revisar');
        expect(document.querySelector('header.tope .head-num')).toHaveTextContent('02');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tus agendas, tus ventas y tus leads.');
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
        sesion.pendientesAgendas = 0;
        sesion.pendientes = 3;
        sesion.openPlaybook = vi.fn();
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        api.get.mockImplementation(() => Promise.resolve({ data: { total: sesion.reportesHoy } }));
    });

    const abrirSesion = async (nombre) => {
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: nombre })); });
    };

    it('el header ya no tiene Playbook ni cerrar sesión: el avatar del dock lleva lo pendiente, y el Playbook está en Cortex (el Portal)', async () => {
        await montar('/setter/deck?step=agendas');

        const header = document.querySelector('header.tope');
        expect(header.querySelectorAll('button')).toHaveLength(0);
        const avatar = screen.getByRole('button', { name: 'Tu sesión: Ana Setter, 3 videos pendientes del Playbook' });
        expect(dock().contains(avatar)).toBe(true);
        expect(avatar.querySelector('.dock-sesion-aviso')).toHaveTextContent('3');

        await abrirSesion('Tu sesión: Ana Setter, 3 videos pendientes del Playbook');
        expect(screen.getByText('Setter')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem').map(i => i.getAttribute('aria-label') || i.textContent))
            .toEqual(['Mis links de agendamiento', 'Tálamus', 'Configuración', 'Portal, 3 videos pendientes del Playbook, en Cortex', 'Mis reportes',
                'Reportar un problema', 'Cerrar sesión']);
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
            .toEqual(['Mis links de agendamiento', 'Tálamus', 'Configuración', 'Portal', 'Mis reportes', 'Reportar un problema', 'Volver a mi sesión', 'Cerrar sesión']);
    });

    it('«Tálamus» lleva a Agendas 2.0, donde el setter mira en solo lectura', async () => {
        await montar('/setter/deck?step=agendas');
        await abrirSesion('Tu sesión: Ana Setter, 3 videos pendientes del Playbook');

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Tálamus' })); });

        expect(screen.getByTestId('ruta')).toHaveTextContent(/^\/agendas-v2$/);
    });

    it('"Mis links de agendamiento" trae los de Agendas 2.0 y también los de los eventos viejos', async () => {
        // El botón "Links de Agendamiento" de la pestaña Historial (que se fue el 10/10/2026) daba los
        // links de los eventos viejos (/book/<slug>): siguen al alcance, en el mismo panel.
        api.get.mockImplementation((ruta) => Promise.resolve({
            data: ruta === '/setter/agendas-links'
                ? { links: [{ funnel: 'Setting', evento: 'Llamada', ruta: '/agendas-v2/agenda/setting/llamada?o=ana' }] }
                : ruta === '/setter/booking-link'
                    ? [{ id: 1, name: 'Grupo viejo', links: [{ id: 9, name: 'Evento viejo', url: 'https://x.test/book/viejo' }] }]
                    : { total: 0 },
        }));
        await montar('/setter/deck?step=agendas');
        await abrirSesion('Tu sesión: Ana Setter, 3 videos pendientes del Playbook');

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Mis links de agendamiento' })); });

        expect(screen.getByRole('menuitem', { name: 'Setting · Llamada' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Grupo viejo · Evento viejo' })).toBeInTheDocument();
    });
});
