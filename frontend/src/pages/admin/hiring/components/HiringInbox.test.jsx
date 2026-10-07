import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import HiringInbox from './HiringInbox';

/**
 * El inbox de Hiring: la barra de Pendientes (título + Híbridos/Online/Incompletas en una sola
 * línea), los contadores por modalidad y el borrado de postulaciones.
 *
 * Se mockea `api` para mirar el pedido real (filtro y modalidad) y el modal de la candidata
 * porque no es lo que se prueba acá.
 */

vi.mock('../../../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('./HiringCandidateModal', () => ({
    default: ({ applicationId }) => <div data-testid="modal-candidata">{applicationId}</div>,
}));

const fila = (id, nombre, extra = {}) => ({
    id, nombre, pais: 'Argentina', edad: '28', modalidad: 'online', veredicto: 'sin_analizar',
    experiencia: '', ia_avanzado: '', sheets: '', ingles: '', idioma2: '', remuneracion: '300',
    video_ok: false, cv: '', whatsapp: '', score: 70, ...extra,
});

const CONTEOS = {
    sin_analizar: 7, incompletas: 3, todas: 12, seleccionadas: 1, en_reserva: 1, descartadas: 0,
    testeo: 0, winners: 0, top_tier: 0, bajas: 0, completas: 9, con_video: 2, hibrido: 4, online: 3,
};

/** Backend de mentira: devuelve un listado fijo y guarda cada pedido para inspeccionarlo. */
const montarApi = ({ postulaciones = [fila(1, 'Ana Pérez'), fila(2, 'Bea Gómez')], conteos = CONTEOS, total = 9 } = {}) => {
    api.get.mockImplementation(() => Promise.resolve({
        data: { postulaciones, conteos, conteos_globales: conteos, total },
    }));
};

const pedidos = () => api.get.mock.calls.map(([ruta]) => ruta);

beforeEach(() => {
    vi.clearAllMocks();
    montarApi();
});
afterEach(() => vi.useRealTimers());

describe('barra de Pendientes', () => {
    it('pone el título y los toggles Híbridos, Online e Incompletas en la misma fila', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        const titulo = screen.getByRole('heading', { level: 1, name: 'Pendientes' });
        const fila = titulo.parentElement;
        expect(fila.className).toContain('flex-wrap');
        for (const nombre of [/Híbridos/, /Online/, /Incompletas/]) {
            expect(fila).toContainElement(screen.getByRole('button', { name: nombre }));
        }
    });

    it('ya no tiene una segunda barra de sub-filtros ni un botón «Sin analizar»', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        expect(screen.queryByRole('button', { name: /Sin analizar/ })).not.toBeInTheDocument();
    });

    it('arranca en «sin analizar» y muestra el contador de cada toggle', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        expect(pedidos()[0]).toBe('/assistant-applications?filtro=sin_analizar');
        expect(screen.getByRole('button', { name: /Híbridos/ })).toHaveTextContent('4');
        expect(screen.getByRole('button', { name: /Online/ })).toHaveTextContent('3');
        expect(screen.getByRole('button', { name: /Incompletas/ })).toHaveTextContent('3');
    });

    it('Incompletas se prende y se apaga, y vuelve a «sin analizar»', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        const incompletas = screen.getByRole('button', { name: /Incompletas/ });

        fireEvent.click(incompletas);
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=incompletas'));
        expect(incompletas).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(incompletas);
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=sin_analizar'));
        expect(incompletas).toHaveAttribute('aria-pressed', 'false');
    });

    it('Incompletas respeta la modalidad elegida', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        fireEvent.click(screen.getByRole('button', { name: /Híbridos/ }));
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=sin_analizar&modalidad=hibrido'));
        fireEvent.click(screen.getByRole('button', { name: /Incompletas/ }));

        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=incompletas&modalidad=hibrido'));
    });
});

describe('contadores y tarjetas KPI', () => {
    // «Sin analizar» también es el texto del chip de cada fila: la etiqueta de la tarjeta es la gris.
    const kpi = (etiqueta) => screen.getAllByText(etiqueta).find((el) => el.className.includes('text-white/50')).parentElement;

    it('«Postulaciones» muestra el total del backend (solo completas) y el resto de las tarjetas, sus conteos', async () => {
        montarApi({
            conteos: { ...CONTEOS, seleccionadas: 2, en_reserva: 1, descartadas: 1, testeo: 1, winners: 1, top_tier: 1, bajas: 1 },
            total: 9,
        });
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        expect(kpi('Postulaciones')).toHaveTextContent('9');
        expect(kpi('Sin analizar')).toHaveTextContent('7');
        // Analizadas = Analizados + Finalistas del dock: no deja afuera a Winner ni a Top tier.
        expect(kpi('Analizadas')).toHaveTextContent('8');
        expect(kpi('Con video verificado')).toHaveTextContent('2');
    });

    it('con Híbridos elegido, las sub-pestañas y las tarjetas cuentan los de esa modalidad y el dock sigue con el total global', async () => {
        const vacio = { ...Object.fromEntries(Object.keys(CONTEOS).map((k) => [k, 0])), hibrido: 4, online: 3 };
        const onConteos = vi.fn();
        api.get.mockImplementation((ruta) => Promise.resolve({
            data: ruta.includes('modalidad=hibrido')
                ? { postulaciones: [], conteos: vacio, conteos_globales: CONTEOS, total: 0 }
                : { postulaciones: [fila(1, 'Ana Pérez')], conteos: CONTEOS, conteos_globales: CONTEOS, total: 9 },
        }));
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" onConteos={onConteos} />);
        await screen.findByText('Ana Pérez');
        expect(screen.getByRole('button', { name: /Incompletas/ })).toHaveTextContent('3');

        fireEvent.click(screen.getByRole('button', { name: /Híbridos/ }));

        await waitFor(() => expect(screen.getByRole('button', { name: /Incompletas/ })).toHaveTextContent('0'));
        expect(kpi('Sin analizar')).toHaveTextContent('0');
        expect(kpi('Postulaciones')).toHaveTextContent('0');
        // El toggle de modalidad sigue mostrando lo de la pestaña, no 0.
        expect(screen.getByRole('button', { name: /Híbridos/ })).toHaveTextContent('4');
        // Y el dock nunca se enteró: todas las llamadas llevan el total global.
        expect(onConteos).toHaveBeenCalled();
        for (const [resumen] of onConteos.mock.calls) {
            expect(resumen).toEqual({ pendientes: 7, analizados: 2, finalistas: 0 });
        }
    });

    it('tolera un backend sin conteos_globales', async () => {
        const onConteos = vi.fn();
        api.get.mockResolvedValue({ data: { postulaciones: [fila(1, 'Ana Pérez')], conteos: CONTEOS, total: 9 } });
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" onConteos={onConteos} />);
        await screen.findByText('Ana Pérez');

        expect(onConteos).toHaveBeenCalledWith({ pendientes: 7, analizados: 2, finalistas: 0 });
    });
});

describe('eliminar una postulación', () => {
    /** Reloj falso DESPUÉS de que la lista cargó: así solo el temporizador de «Deshacer» es controlable. */
    const conRelojFalso = () => vi.useFakeTimers({ shouldAdvanceTime: true });
    const avanzar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    const papelera = (nombre) => screen.getByRole('button', { name: `Eliminar la postulación de ${nombre}` });

    it('la papelera pregunta en el lugar, sin abrir el modal de la candidata', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        fireEvent.click(papelera('Ana Pérez'));

        expect(screen.getByText('¿Borrar?')).toBeInTheDocument();
        expect(screen.queryByTestId('modal-candidata')).not.toBeInTheDocument();
        expect(api.delete).not.toHaveBeenCalled();
    });

    it('al confirmar espera la ventana de «Deshacer», borra, quita la fila y refresca los conteos sin parpadear', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        api.delete.mockResolvedValue({ data: { status: 'success' } });
        const cargasAntes = pedidos().length;
        conRelojFalso();

        fireEvent.click(papelera('Ana Pérez'));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
        expect(screen.getByRole('button', { name: /Deshacer/ })).toBeInTheDocument();
        await avanzar(4000);
        expect(api.delete).not.toHaveBeenCalled();

        montarApi({ postulaciones: [fila(2, 'Bea Gómez')], conteos: { ...CONTEOS, sin_analizar: 6 }, total: 8 });
        await avanzar(1500);

        expect(api.delete).toHaveBeenCalledWith('/assistant-applications/1');
        await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument());
        expect(screen.getByText('Bea Gómez')).toBeInTheDocument();
        expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
        await waitFor(() => expect(pedidos()).toHaveLength(cargasAntes + 1));
        await waitFor(() => expect(screen.getAllByText('6').length).toBeGreaterThan(0));
    });

    it('Deshacer cancela: no se borra nada', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        conRelojFalso();

        fireEvent.click(papelera('Ana Pérez'));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
        fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
        await avanzar(6000);

        expect(api.delete).not.toHaveBeenCalled();
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    });

    it('si el borrado falla la fila se queda y se explica por qué', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        api.delete.mockRejectedValue({ response: { data: { message: 'Error interno al eliminar la postulación' } } });
        conRelojFalso();

        fireEvent.click(papelera('Ana Pérez'));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
        await avanzar(5500);

        expect(await screen.findByRole('alert')).toHaveTextContent('Error interno al eliminar la postulación');
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Eliminar la postulación de Ana Pérez' })).toBeInTheDocument();
    });

    it('la recarga posterior al borrado usa la vista de ahora y no la del momento de confirmar', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        api.delete.mockResolvedValue({ data: { status: 'success' } });
        conRelojFalso();

        fireEvent.click(papelera('Ana Pérez'));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
        fireEvent.click(screen.getByRole('button', { name: /Online/ }));
        await avanzar(5500);

        await waitFor(() => expect(api.delete).toHaveBeenCalled());
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=sin_analizar&modalidad=online'));
    });
});

describe('Analizados, Finalistas y búsqueda', () => {
    it('Analizados mantiene su título y sus sub-filtros de estado', async () => {
        render(<HiringInbox grupo="analizados" titulo="Analizados" />);
        await screen.findByText('Ana Pérez');

        expect(screen.getByRole('heading', { level: 1, name: 'Analizados' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Seleccionadas/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reserva/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Descartadas/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Híbridos/ })).not.toBeInTheDocument();
        expect(pedidos()[0]).toBe('/assistant-applications?filtro=seleccionadas');
    });

    it('Finalistas cambia de sub-filtro', async () => {
        render(<HiringInbox grupo="finalistas" titulo="Finalistas" />);
        await screen.findByText('Ana Pérez');

        fireEvent.click(screen.getByRole('button', { name: /Winner/ }));

        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=winners'));
    });

    it('la búsqueda recorre todo el pool y no ofrece toggles', async () => {
        render(<HiringInbox grupo="busqueda" query="ana" titulo="Resultados para «ana»" />);
        await screen.findByText('Ana Pérez');

        expect(screen.getByRole('heading', { level: 1, name: 'Resultados para «ana»' })).toBeInTheDocument();
        expect(pedidos()[0]).toBe('/assistant-applications?filtro=todas');
        expect(screen.queryByRole('button', { name: /Incompletas/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Bea Gómez')).not.toBeInTheDocument();
    });
});
