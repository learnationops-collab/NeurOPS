import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import HiringDashboardPage from './HiringDashboardPage';

/**
 * Learnation Talent: el listado se pide una sola vez y las secciones del dock, las pestañas, la
 * búsqueda y el borrado se resuelven sobre ese listado.
 */

vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
let usuario = { username: 'Mario Hire', role: 'hiring' };
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: usuario, logout: vi.fn() }),
}));
vi.mock('./components/HiringCandidateModal', () => ({
    default: ({ applicationId, ids }) => <div data-testid="modal-candidata">{applicationId}|{ids.join(',')}</div>,
}));
vi.mock('./components/HiringStats', () => ({ default: () => <div data-testid="stats" /> }));
vi.mock('./components/forms/HiringForms', () => ({ default: () => <div data-testid="forms" /> }));
// Closers hospeda las pestañas de Postulaciones: acá alcanza con saber cuál se monta.
vi.mock('../postulaciones/components/PostulacionesInbox', () => ({
    default: ({ grupo }) => <div data-testid="postulaciones">inbox {grupo}</div>,
}));
vi.mock('../postulaciones/components/PostulacionesRevisoresTab', () => ({ default: () => <div data-testid="postulaciones">revisores</div> }));
vi.mock('../postulaciones/components/PostulacionesStatsTab', () => ({ default: () => <div data-testid="postulaciones">estadisticas</div> }));
vi.mock('../postulaciones/components/PostulacionesClarityTab', () => ({ default: () => <div data-testid="postulaciones">clarity</div> }));

const fila = (id, nombre, extra = {}) => ({
    id, nombre, pais: 'Argentina', provincia: 'Salta', edad: '28', modalidad: 'hibrido', veredicto: 'sin_analizar',
    experiencia: '', ia_avanzado: '', sheets: '', ingles: '', idioma2: '', remuneracion: '300', completo: true,
    video_ok: true, cv: 'x', whatsapp: '+54 9 11 1234 5678', score: 70, created_at: '2026-10-07T10:00:00', ...extra,
});

const LISTA = [
    fila(1, 'Ana Pérez', { score: 80 }),
    fila(2, 'Bea Gómez', { score: 90 }),
    fila(3, 'Caro Díaz', { modalidad: 'online', pais: '🇻🇪  Venezuela', provincia: 'Zulia' }),
    fila(4, 'Dani Ruiz', { veredicto: 'incompleta', completo: false }),
    fila(5, 'Eli Sosa', { veredicto: 'seleccionada' }),
    fila(6, 'Fer Luna', { veredicto: 'winner' }),
];

beforeEach(() => {
    vi.clearAllMocks();
    usuario = { username: 'Mario Hire', role: 'hiring' };
    window.localStorage.clear();
    window.sessionStorage.clear();
    api.get.mockImplementation((ruta) => {
        if (ruta.startsWith('/assistant-applications?')) return Promise.resolve({ data: { postulaciones: LISTA } });
        if (ruta === '/assistant-applications/clarity-weights') return Promise.resolve({ data: [{ criterion: 'ia', weight: 10 }] });
        if (ruta === '/hiring/config') return Promise.resolve({ data: { presupuesto_max: 400, puesto: 'Asistente' } });
        if (/^\/assistant-applications\/\d+$/.test(ruta)) return Promise.resolve({ data: { criterios: { ia: 0.9 } } });
        return Promise.reject(new Error(`sin mock: ${ruta}`));
    });
    api.delete.mockResolvedValue({ data: { status: 'success' } });
});

const montar = () => render(<MemoryRouter><HiringDashboardPage /></MemoryRouter>);
const tabla = () => screen.getByRole('table', { name: 'Postulaciones' });

describe('Learnation Talent', () => {
    it('pide el listado una sola vez y abre el Inbox en los híbridos, ordenados por score', async () => {
        montar();
        await waitFor(() => expect(within(tabla()).getByText('Bea Gómez')).toBeInTheDocument());
        const nombres = within(tabla()).getAllByText(/Pérez|Gómez|Díaz|Ruiz|Sosa|Luna/).map((n) => n.textContent);
        expect(nombres).toEqual(['Bea Gómez', 'Ana Pérez']);
        expect(api.get.mock.calls.filter(([r]) => r.startsWith('/assistant-applications?'))).toEqual([['/assistant-applications?filtro=todas']]);
        expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    });

    it('la próxima a revisar es la de mejor score de la tanda', async () => {
        montar();
        const foco = await screen.findByLabelText('Próxima a revisar');
        expect(within(foco).getByText('Bea Gómez')).toBeInTheDocument();
    });

    it('las pestañas cambian la tanda sin volver a pedir datos', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(screen.getByRole('button', { name: /Online/ }));
        expect(within(tabla()).getByText('Caro Díaz')).toBeInTheDocument();
        // El país llega con la bandera del formulario viejo y se muestra limpio.
        expect(within(tabla()).getByText('Zulia')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Incompletas/ }));
        expect(within(tabla()).getByText('Dani Ruiz')).toBeInTheDocument();
        expect(api.get.mock.calls.filter(([r]) => r.startsWith('/assistant-applications?'))).toHaveLength(1);
    });

    it('el dock lleva a Winners con sus pestañas', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(screen.getByRole('button', { name: /Winners/ }));
        fireEvent.click(screen.getByRole('button', { name: /^Winner\s*\d+$/ }));
        expect(within(tabla()).getByText('Fer Luna')).toBeInTheDocument();
    });

    it('buscar recorre todas las secciones', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.change(screen.getByLabelText('Buscar postulante'), { target: { value: 'sosa' } });
        expect(screen.getByRole('heading', { level: 1, name: 'Resultados para «sosa»' })).toBeInTheDocument();
        expect(within(tabla()).getByText('Eli Sosa')).toBeInTheDocument();
        expect(within(tabla()).queryByText('Bea Gómez')).not.toBeInTheDocument();
    });

    it('abrir una fila pasa al modal la lista que se estaba viendo', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(within(tabla()).getByText('Ana Pérez'));
        expect(screen.getByTestId('modal-candidata').textContent).toBe('1|2,1');
    });

    it('ordenar por una columna desde su encabezado', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(screen.getByRole('button', { name: /Candidata/ }));
        const nombres = within(tabla()).getAllByText(/Pérez|Gómez/).map((n) => n.textContent);
        expect(nombres).toEqual(['Ana Pérez', 'Bea Gómez']);
    });

    it('Closers hospeda Postulaciones fuera del .dc-shell, con sus pestañas en la cabecera', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(screen.getByRole('button', { name: /^Closers/ }));

        expect(screen.getByRole('heading', { level: 1, name: 'Closers' })).toBeInTheDocument();
        expect(screen.getByText('Closer de ventas')).toBeInTheDocument();
        // El buscador busca candidatas a Asistente: en Closers no va.
        expect(screen.queryByLabelText('Buscar postulante')).not.toBeInTheDocument();
        const contenido = screen.getByTestId('postulaciones');
        expect(contenido.textContent).toBe('inbox pend');
        // Fuera del shell (su reset de botones le borraría los estilos de Tailwind) y con la paleta de siempre.
        expect(contenido.closest('.dc-shell')).toBeNull();
        expect(contenido.closest('main.dash-v6')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Analizados' }));
        expect(screen.getByTestId('postulaciones').textContent).toBe('inbox anal');
        fireEvent.click(screen.getByRole('button', { name: 'Revisores' }));
        expect(screen.getByTestId('postulaciones').textContent).toBe('revisores');

        // Volver a una sección de Talent saca a Postulaciones y trae de vuelta el buscador.
        fireEvent.click(screen.getByRole('button', { name: /^Inbox/ }));
        expect(screen.queryByTestId('postulaciones')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Buscar postulante')).toBeInTheDocument();
    });

    it('?s=closers (el link viejo de Postulaciones) entra en Closers y saca la s de la URL', async () => {
        const Ubicacion = () => <output data-testid="url">{useLocation().search}</output>;
        render(
            <MemoryRouter initialEntries={['/admin/hiring?s=closers']}>
                <HiringDashboardPage />
                <Ubicacion />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { level: 1, name: 'Closers' })).toBeInTheDocument();
        expect(screen.getByTestId('postulaciones').textContent).toBe('inbox pend');
        await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(''));
    });

    it('una ?s= que no es una sección abre el Inbox', async () => {
        render(<MemoryRouter initialEntries={['/admin/hiring?s=otra']}><HiringDashboardPage /></MemoryRouter>);
        await screen.findAllByText('Bea Gómez');
        expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    });

    it('el menú Vista esconde columnas y lo recuerda', async () => {
        montar();
        await screen.findAllByText('Bea Gómez');
        fireEvent.click(screen.getByRole('button', { name: 'Configurar la vista' }));
        fireEvent.click(screen.getByRole('button', { name: /Columnas/ }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'WhatsApp' }));
        expect(within(tabla()).queryByText('WhatsApp')).not.toBeInTheDocument();
        expect(JSON.parse(window.localStorage.getItem('neurops-talent-vista-v1')).cols).not.toContain('wa');
    });
});
