import React from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterEspacioPage from './SetterEspacioPage';
import { getTabla } from '../comercial/comercialApi';

/**
 * Revisar del setter (10/10/2026): sus agendas, sus ventas y sus leads, y la lista detrás de cada
 * número de "Mis datos".
 *
 * Pedido del usuario: «una pestaña de revisar donde pueda ver todas sus agendas, porque Mis agendas
 * debe vaciarse [...] y las ventas que se van registrando con su fuente, como las listas de los
 * closers y directores pero solo con las suyas». Antes (01/10) sus listas vivían en Reporte ·
 * Registros. A diferencia de `SetterEspacioPage.test.jsx`, acá el dashboard es el REAL —Analizar,
 * Revisar, su fila de etiquetas y su tira de totales— y solo se reemplaza la API: lo que se prueba
 * es que cada pestaña muestre su tabla con las columnas del setter, que un número tocado aterrice en
 * su lista con el filtro puesto y tantas filas como decía, y que el setter no tenga selector de
 * persona en ningún lado.
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

const chipDe = (key, label, tone = 'idle') => ({ key, label, tone });
const agenda = (id, palabra, post = ['pendiente', 'Pendiente']) => ({
    tipo: 'agenda', id, client_id: 100 + id, creada: '2026-10-02T12:00:00', fecha: '2026-10-05T15:00:00',
    cliente: `Agenda ${id}`, ig: '', email: '', telefono: '', fuente: 'Ana Setter', palabra_clave: palabra,
    closer: 'Marlon', closer_id: 3, setter: SETTER.nombre, setter_id: SETTER.id,
    pre_call: chipDe('confirmada', 'Confirmada', 'info'), post_call: chipDe(...post),
    asistio: post[0] === 'asistio', realizada: post[0] === 'asistio', no_cerrada: post[0] === 'asistio',
    presento: false, retraso_dias: 0, ya_paso: false, descartada: false,
});

// 3 agendas: dos todavía sin la palabra clave del anuncio.
const AGENDAS = [agenda(1, 'AULA', ['asistio', 'Asistió', 'success']), agenda(2, ''), agenda(3, '')];

const venta = (id, cliente, tipo, monto) => ({
    tipo: 'venta', id, client_id: 200 + id, fecha: '2026-10-03T12:00:00', creada: '2026-10-03T12:00:00',
    cliente, ig: '', email: '', telefono: '', programa: 'Residency Roadmap',
    tipo_pago: chipDe(tipo, tipo === 'parcial' ? 'Split Pay' : 'Cuotas'), tipo_pago_raw: 'RR',
    es_venta: tipo === 'parcial', monto, monto_neto: monto, metodo: 'zelle', closer: 'Marlon', setter: '',
    sena_estado: null, academia: null,
    procedencia: { key: 'setting', label: 'Setting', tone: 'cat-2' },
    procedencia_detalle: { key: 'ana setter', label: SETTER.nombre },
});

const VENTAS = [venta(1, 'Caro Paz', 'parcial', 1000), venta(2, 'Caro Paz', 'cuota', 500)];

const BLOQUE = {
    leads: 5, respondieron: 3, respuesta: 60, cualificados: 2, cualificacion: 66.7, agendas: 1,
    conversion: 20, mensajes: 11, generadas: 3, show_up: 100, ventas_originadas: 0,
    tenacidad: [{ toques: '1', leads: 2 }, { toques: '2', leads: 1 }, { toques: '3', leads: 1 },
        { toques: '4+', leads: 1 }],
    funnel: [{ paso: 'Entrantes', n: 5 }, { paso: 'Respondieron', n: 3 }, { paso: 'Cualificados', n: 2 },
        { paso: 'Agendaron', n: 1 }],
};

const api = vi.hoisted(() => ({ filas: {} }));

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
        tabla, rol: 'setters', filas: api.filas[tabla] ?? [], totales: {},
    })),
    getNoCerradas: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));

vi.mock('../../components/ficha/FichaLeadModal', () => ({
    default: ({ appointmentId, clientId }) => (
        <div data-testid="ficha">{`agenda ${appointmentId} · cliente ${clientId}`}</div>
    ),
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
vi.mock('./agendas/MisAgendas', () => ({ default: () => <div data-testid="mis-agendas" /> }));
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

const filas = (prefijo) => screen.queryAllByRole('button', { name: new RegExp(`^Abrir ${prefijo} `) });
const tile = async (nombre) => (await screen.findByText(nombre, { selector: '.t-eyebrow' })).closest('section');
const encabezados = () => Array.from(document.querySelectorAll('.tabla-cab > span')).map(s => s.textContent);
const tira = () => screen.getByRole('group', { name: /^Totales/ });

describe('Revisar del setter · sus agendas, sus ventas y sus leads', () => {
    beforeEach(() => {
        window.localStorage.clear();
        getTabla.mockClear();
        api.filas = { leads: LEADS, generadas: AGENDAS, ventas: VENTAS };
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('abre en Agendas: todas, con la palabra clave y cuántas les falta', async () => {
        await montar('/setter/deck?step=revisar');

        await screen.findByText(`mostrando ${AGENDAS.length} de ${AGENDAS.length}`);
        expect(getTabla.mock.calls.at(-1)[1]).toBe('generadas');
        expect(filas('Agenda')).toHaveLength(AGENDAS.length);
        // Su columna es la palabra clave, no él mismo.
        expect(encabezados()).toEqual(['Reunión', 'Lead', 'Palabra clave', 'Closer', 'Pre call', 'Post call', '']);
        expect(screen.getByText('AULA')).toBeInTheDocument();
        expect(screen.getAllByText('Sin palabra clave').length).toBeGreaterThanOrEqual(2);
        // «3 agendas · 2 sin palabra clave»: el total de la tira con su bajada. La cifra cuenta hasta
        // su valor (`Cifra`), así que se la espera.
        const total = within(tira()).getByText('agendas').closest('.tot-celda');
        await waitFor(() => expect(total.querySelector('.tot-n')).toHaveTextContent('3'));
        expect(total).toHaveTextContent('2 sin palabra clave');
        // La tabla la eligen las pestañas del espacio: no hay una segunda fila de pestañas.
        expect(screen.queryByRole('tablist', { name: 'Tabla' })).toBeNull();
    });

    it('el filtro rápido «Sin palabra clave» deja las que todavía no la tienen', async () => {
        await montar('/setter/deck?step=revisar&tab=agendas');
        await screen.findByText(`mostrando ${AGENDAS.length} de ${AGENDAS.length}`);

        fireEvent.click(screen.getByRole('button', { name: /^Vigentes/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^Sin palabra clave/ }));

        expect(filas('Agenda').map(f => f.getAttribute('aria-label'))).toEqual(['Abrir Agenda 2', 'Abrir Agenda 3']);
    });

    it('Ventas: sus cobros con el monto y el closer, y los totales de esos cobros', async () => {
        await montar('/setter/deck?step=revisar');
        await screen.findByText(`mostrando ${AGENDAS.length} de ${AGENDAS.length}`);

        fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }));

        await screen.findByText(`mostrando ${VENTAS.length} de ${VENTAS.length}`);
        expect(getTabla.mock.calls.at(-1)[1]).toBe('ventas');
        expect(url().get('tab')).toBe('ventas');
        expect(encabezados()).toEqual(expect.arrayContaining(['Monto', 'Closer']));
        expect(screen.getAllByRole('button', { name: 'Abrir Caro Paz' })).toHaveLength(2);
        // «1 venta · $1,500»: la cuota suma al cash pero no es una venta.
        const ventas = within(tira()).getByText('venta').closest('.tot-celda');
        const cash = within(tira()).getByText('cash').closest('.tot-celda');
        await waitFor(() => expect(ventas.querySelector('.tot-n')).toHaveTextContent('1'));
        await waitFor(() => expect(cash.querySelector('.tot-n')).toHaveTextContent('$1,500'));
    });

    it('sin ventas de su fuente en el período, un estado vacío que lo dice', async () => {
        api.filas.ventas = [];
        await montar('/setter/deck?step=revisar&tab=ventas');

        expect(await screen.findByText('Todavía no hay ventas de tu fuente en este período')).toBeInTheDocument();
        // No es «ningún registro entra por este filtro»: no hay filtro que sacar.
        expect(screen.queryByText('Ningún registro entra por este filtro')).toBeNull();
        expect(screen.queryByRole('button', { name: /Limpiar todo/ })).toBeNull();
    });

    it('Leads: sin las columnas que en su lista son siempre lo mismo', async () => {
        await montar('/setter/deck?step=revisar&tab=leads');

        await screen.findByText(`mostrando ${LEADS.length} de ${LEADS.length}`);
        expect(getTabla.mock.calls.at(-1)[1]).toBe('leads');
        expect(encabezados()).toEqual(['Llegó', 'Lead', 'Estado', 'Mensajes', '']);
    });

    it('una fila abre la ficha de ESE lead: la agenda por su id, la venta por su cliente', async () => {
        await montar('/setter/deck?step=revisar');
        await screen.findByText(`mostrando ${AGENDAS.length} de ${AGENDAS.length}`);

        fireEvent.click(screen.getByRole('button', { name: 'Abrir Agenda 2' }));
        expect(screen.getByTestId('ficha')).toHaveTextContent('agenda 2 · cliente null');

        fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }));
        await screen.findByText(`mostrando ${VENTAS.length} de ${VENTAS.length}`);
        fireEvent.click(screen.getAllByRole('button', { name: 'Abrir Caro Paz' })[0]);
        expect(screen.getByTestId('ficha')).toHaveTextContent('agenda null · cliente 201');
    });

    it('sin selector de persona ni de equipo, y la lista dice de quién es', async () => {
        await montar('/setter/deck?step=revisar');
        await screen.findByText(`mostrando ${AGENDAS.length} de ${AGENDAS.length}`);

        expect(screen.queryByRole('button', { name: /Todo el equipo/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Closers$/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Setters$/ })).toBeNull();
        expect(screen.getByText('Ana Setter · este mes')).toBeInTheDocument();
    });
});

describe('Revisar del setter · de un número de "Mis datos" a su lista', () => {
    beforeEach(() => {
        window.localStorage.clear();
        getTabla.mockClear();
        api.filas = { leads: LEADS, generadas: AGENDAS, ventas: VENTAS };
        vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('el ojo de "Tasa de respuesta" abre Revisar › Leads con «Respondió: Sí» y tantas filas como dice', async () => {
        await montar('/setter/deck?step=datos&p=mes');

        const respuesta = await tile('Tasa de respuesta');
        fireEvent.click(within(respuesta).getByRole('button', { name: /^Ver los registros/ }));

        expect(await screen.findByRole('button', { name: 'Quitar Respondió: Sí' })).toBeInTheDocument();
        expect(screen.getByText('Cumple todas:')).toBeInTheDocument();
        expect(filas('Lead')).toHaveLength(BLOQUE.respondieron);
        expect(screen.getByText(`mostrando ${BLOQUE.respondieron} de ${BLOQUE.respondieron}`)).toBeInTheDocument();

        expect(url().get('step')).toBe('revisar');
        expect(url().get('tab')).toBe('leads');
        expect(url().get('t')).toBe('leads');
        expect(url().get('p')).toBe('mes');
        expect(screen.getByRole('tab', { name: 'Leads' })).toHaveAttribute('aria-selected', 'true');
        expect(getTabla.mock.calls.at(-1)[1]).toBe('leads');
    });

    it('un paso del embudo también aterriza filtrado, y "atrás" vuelve al tablero', async () => {
        await montar('/setter/deck?step=datos&p=mes');

        fireEvent.click(await screen.findByRole('button', { name: 'Cualificados' }));

        expect(await screen.findByRole('button', { name: 'Quitar Cualificado: Sí' })).toBeInTheDocument();
        expect(filas('Lead')).toHaveLength(BLOQUE.cualificados);

        fireEvent.click(screen.getByRole('button', { name: 'atrás' }));

        expect(await tile('Entrantes')).toBeInTheDocument();
        expect(url().get('step')).toBe('datos');
    });

    it('en "Mis datos" tampoco hay selector de persona', async () => {
        await montar('/setter/deck?step=datos');

        await tile('Entrantes');
        expect(screen.queryByRole('button', { name: /Todo el equipo/ })).toBeNull();
        expect(screen.queryByRole('tab', { name: 'Comparativas' })).toBeNull();
    });
});
