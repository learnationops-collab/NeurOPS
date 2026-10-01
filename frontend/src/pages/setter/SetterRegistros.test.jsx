import React from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterEspacioPage from './SetterEspacioPage';
import { getTabla } from '../comercial/comercialApi';

/**
 * Reporte · Registros: la lista que hay detrás de cada número de "Mis datos" (01/10/2026).
 *
 * Pedido de Kerwin: "como con los closers, que cliqueen y vean sus datos; el setter trabaja con
 * Reporte, que los vea dentro de su reporte". A diferencia de `SetterEspacioPage.test.jsx`, acá el
 * dashboard es el REAL —Analizar, Revisar y su fila de etiquetas— y solo se reemplaza la API: lo
 * que se prueba es que el número tocado aterrice en la lista con su filtro puesto y con tantas
 * filas como decía, y que el setter no tenga selector de persona en ningún lado.
 */

const SETTER = { id: 7, nombre: 'Ana Setter' };

const lead = (id, { respondio = false, cualificado = false, agendo = false, mensajes = 1 } = {}) => {
    const estado = agendo ? ['agendo', 'Agendó', 'success']
        : respondio ? ['en_conversacion', 'En conversación', 'info'] : ['sin_respuesta', 'Sin respuesta', 'idle'];
    return {
        tipo: 'lead', id, fecha: '2026-10-01T10:00:00', creada: '2026-10-01T10:00:00',
        cliente: `Lead ${id}`, ig: `lead${id}`, email: '', telefono: '', fuente: 'ManyChat',
        setter: SETTER.nombre, estado: { key: estado[0], label: estado[1], tone: estado[2] },
        mensajes, respondio, cualificado, agendo, ultimo: null,
    };
};

// 5 leads: 3 respondieron, 2 cualificaron, 1 agendó. Es lo que dice el resumen de abajo.
const LEADS = [
    lead(1, { respondio: true, cualificado: true, agendo: true, mensajes: 4 }),
    lead(2, { respondio: true, cualificado: true, mensajes: 3 }),
    lead(3, { respondio: true, mensajes: 2 }),
    lead(4),
    lead(5),
];

const BLOQUE = {
    leads: 5, respondieron: 3, respuesta: 60, cualificados: 2, cualificacion: 66.7, agendas: 1,
    conversion: 20, mensajes: 11, generadas: 1, show_up: null, ventas_originadas: 0,
    tenacidad: [{ toques: '1', leads: 2 }, { toques: '2', leads: 1 }, { toques: '3', leads: 1 },
        { toques: '4+', leads: 1 }],
    funnel: [{ paso: 'Entrantes', n: 5 }, { paso: 'Respondieron', n: 3 }, { paso: 'Cualificados', n: 2 },
        { paso: 'Agendaron', n: 1 }],
};

vi.mock('../comercial/comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        rol: 'setters', miembro_id: 7, puede_elegir_equipo: false, puede_reportar: false,
        yo: { id: 7, nombre: 'Ana Setter', rol: 'setter' }, miembros: [], miembros_por_rol: {},
        estados: { pre_call: [], post_call: [] },
        periodos: [{ key: 'mes', label: 'Este mes' }, { key: 'hoy', label: 'Hoy' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({
        rol: 'setters', actual: BLOQUE, deltas: {},
        dates: { start: '2026-10-01', end: '2026-10-31' },
    })),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn((_filtros, tabla) => Promise.resolve({
        tabla, rol: 'setters', filas: tabla === 'leads' ? LEADS : [], totales: {},
    })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, name: 'Ana Setter', role: 'setter', is_impersonating: false }, logout: vi.fn() }),
}));
vi.mock('../../contexts/PlaybookContext', () => ({
    usePlaybook: () => ({ pendingCount: 0, openPlaybook: vi.fn() }),
}));
vi.mock('../../services/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: { total: 0 } })) },
}));
vi.mock('../../utils/impersonation', () => ({ revertImpersonation: vi.fn(), simularA: vi.fn() }));
vi.mock('../../components/modals/OperatorControls', () => ({ default: () => null }));
vi.mock('./SetterWorkflowPage', () => ({ default: () => <div data-testid="mazo" /> }));
vi.mock('./agendas/SetterAgendasPage', () => ({ default: () => null }));
vi.mock('../public/PublicSetterReportPage', () => ({ default: () => null }));
vi.mock('../public/PublicSetterStatsPage', () => ({ default: () => null }));

const Ubicacion = () => {
    const { search } = useLocation();
    return <output data-testid="url">{search}</output>;
};
const Atras = () => {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(-1)}>atrás</button>;
};
const url = () => new URLSearchParams(screen.getByTestId('url').textContent);

const montar = async (ruta) => {
    render(
        <MemoryRouter initialEntries={[ruta]}>
            <SetterEspacioPage />
            <Ubicacion />
            <Atras />
        </MemoryRouter>,
    );
    await act(async () => {});
};

const registros = () => screen.queryAllByRole('button', { name: /^Abrir Lead / });
const tile = async (nombre) => (await screen.findByText(nombre, { selector: '.t-eyebrow' })).closest('section');

describe('Espacio del setter · de un número de "Mis datos" a su lista en Registros', () => {
    beforeEach(() => {
        window.localStorage.clear();
        getTabla.mockClear();
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('el ojo de "Tasa de respuesta" abre sus leads con «Respondió: Sí» y tantas filas como dice', async () => {
        await montar('/setter/deck?step=datos&p=mes');

        const respuesta = await tile('Tasa de respuesta');
        fireEvent.click(within(respuesta).getByRole('button', { name: /^Ver los registros/ }));

        expect(await screen.findByRole('button', { name: 'Quitar Respondió: Sí' })).toBeInTheDocument();
        expect(screen.getByText('Cumple todas:')).toBeInTheDocument();
        expect(registros()).toHaveLength(BLOQUE.respondieron);
        expect(screen.getByText(`mostrando ${BLOQUE.respondieron} de ${BLOQUE.respondieron}`)).toBeInTheDocument();

        expect(url().get('step')).toBe('reporte');
        expect(url().get('tab')).toBe('registros');
        expect(url().get('t')).toBe('leads');
        expect(url().get('p')).toBe('mes');
        expect(getTabla.mock.calls.at(-1)[1]).toBe('leads');
    });

    it('un paso del embudo también aterriza filtrado, y "atrás" vuelve al tablero', async () => {
        await montar('/setter/deck?step=datos&p=mes');

        fireEvent.click(await screen.findByRole('button', { name: 'Cualificados' }));

        expect(await screen.findByRole('button', { name: 'Quitar Cualificado: Sí' })).toBeInTheDocument();
        expect(registros()).toHaveLength(BLOQUE.cualificados);

        fireEvent.click(screen.getByRole('button', { name: 'atrás' }));

        expect(await tile('Entrantes')).toBeInTheDocument();
        expect(url().get('step')).toBe('datos');
    });

    it('Registros abierto directo: sus leads sin filtro, y sin selector de persona ni de equipo', async () => {
        await montar('/setter/deck?step=reporte&tab=registros');

        await screen.findByText(`mostrando ${LEADS.length} de ${LEADS.length}`);
        expect(registros()).toHaveLength(LEADS.length);
        expect(screen.queryByText('Cumple todas:')).toBeNull();

        // Sus dos tablas, y ninguna de otro rol.
        const tablas = screen.getByRole('tablist', { name: 'Tabla' });
        expect(within(tablas).getAllByRole('tab').map(t => t.textContent))
            .toEqual(['Leads entrantes', 'Agendas generadas']);

        // Ni el selector de persona de la dirección ni el switch Closers / Setters.
        expect(screen.queryByRole('button', { name: /Todo el equipo/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Closers$/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Setters$/ })).toBeNull();
        // La lista es la suya: lo dice el alcance de la tira de totales.
        expect(screen.getByText('Ana Setter · este mes')).toBeInTheDocument();
    });

    it('en "Mis datos" tampoco hay selector de persona', async () => {
        await montar('/setter/deck?step=datos');

        await tile('Entrantes');
        expect(screen.queryByRole('button', { name: /Todo el equipo/ })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'Comparativas' })).toBeNull();
    });
});
