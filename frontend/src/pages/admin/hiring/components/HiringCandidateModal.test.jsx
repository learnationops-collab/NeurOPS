import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../../../services/api';
import HiringCandidateModal, { Completitud, botonesDe, colorCompletitud, dimensionesPanel } from './HiringCandidateModal';

const postulacion = (extra = {}) => ({
    id: 7,
    nombre: 'Ana Pérez',
    pais: 'Argentina',
    veredicto: 'sin_analizar',
    score: 61,
    bloques: [],
    ...extra,
});

describe('Completitud', () => {
    it('dice cuánto del formulario se completó, con una barra de progreso', () => {
        render(<Completitud valor={62} />);

        expect(screen.getByTestId('completitud').textContent).toBe('Formulario completo al 62 %');
        const barra = screen.getByRole('progressbar');
        expect(barra.getAttribute('aria-valuenow')).toBe('62');
        expect(barra.firstChild.style.width).toBe('62%');
    });

    it('no dibuja nada si el backend no mandó el dato', () => {
        for (const valor of [undefined, null, '', 'abc', NaN]) {
            const { container, unmount } = render(<Completitud valor={valor} />);
            expect(container.firstChild).toBeNull();
            unmount();
        }
    });

    it('el 0 sí se dibuja: es un dato, no una ausencia', () => {
        render(<Completitud valor={0} />);
        expect(screen.getByTestId('completitud').textContent).toBe('Formulario completo al 0 %');
    });

    it('acota a 0-100 y redondea lo que viene fuera de rango', () => {
        const { rerender } = render(<Completitud valor={140} />);
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
        rerender(<Completitud valor={-5} />);
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
        rerender(<Completitud valor={62.6} />);
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('63');
    });

    it('verde si está completo, ámbar entre 50 y 99, rojo debajo de 50', () => {
        expect(colorCompletitud(100)).toBe('#2FBF8F');
        expect(colorCompletitud(99)).toBe('#D9A441');
        expect(colorCompletitud(50)).toBe('#D9A441');
        expect(colorCompletitud(49)).toBe('#E85C4A');
        expect(colorCompletitud(0)).toBe('#E85C4A');

        const { rerender } = render(<Completitud valor={100} />);
        expect(screen.getByRole('progressbar').firstChild.style.background).toBe('rgb(47, 191, 143)');
        rerender(<Completitud valor={72} />);
        expect(screen.getByRole('progressbar').firstChild.style.background).toBe('rgb(217, 164, 65)');
        rerender(<Completitud valor={20} />);
        expect(screen.getByRole('progressbar').firstChild.style.background).toBe('rgb(232, 92, 74)');
    });
});

describe('HiringCandidateModal · encabezado', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn();
        globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
        vi.clearAllMocks();
    });

    const abrir = async (datos) => {
        api.get.mockResolvedValue({ data: datos });
        render(<HiringCandidateModal applicationId={7} ids={[7]} onClose={vi.fn()} onNavigate={vi.fn()} />);
        await screen.findByText('Ana Pérez');
    };

    it('muestra «Formulario completo al NN %» en la cabecera junto al score', async () => {
        await abrir(postulacion({ completitud: 85 }));

        expect(api.get).toHaveBeenCalledWith('/assistant-applications/7');
        const cabecera = screen.getByRole('dialog').querySelector('header');
        expect(cabecera.textContent).toContain('Formulario completo al 85 %');
        expect(cabecera.textContent).toContain('Score');
    });

    it('sin `completitud` en la respuesta, la cabecera sigue igual y sin la barra', async () => {
        await abrir(postulacion());

        await waitFor(() => expect(screen.getByRole('dialog').querySelector('header').textContent).toContain('Score'));
        expect(screen.queryByTestId('completitud')).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
});

describe('botonesDe: rescatar descartadas, incompletas y las que están en prueba', () => {
    const ids = (d) => botonesDe(d).map((a) => a.id);

    it('a una que cortó el formulario se la puede aprobar o pasar a prueba, sin «Descartar»', () => {
        expect(ids({ veredicto: 'descartado', estado: null })).toEqual(['seleccionada', 'en_reserva', 'testeo']);
    });

    it('a una que descartó un revisor también, y «Descartar» sigue para deshacerlo', () => {
        expect(ids({ veredicto: 'descartado', estado: 'descartado' })).toEqual(['seleccionada', 'en_reserva', 'testeo', 'descartado']);
    });

    it('una incompleta puede ir directo a prueba', () => {
        expect(ids({ veredicto: 'incompleta' })).toContain('testeo');
    });

    it('una en prueba se puede devolver a Seleccionadas o Reserva', () => {
        expect(ids({ veredicto: 'testeo', estado: 'testeo' })).toEqual(['seleccionada', 'en_reserva', 'winner', 'top_tier', 'baja']);
    });

    it('en el modal, una descartada por el formulario ofrece Seleccionar y Pasar a prueba', async () => {
        api.get.mockResolvedValue({ data: postulacion({ veredicto: 'descartado', estado: null, auto_ko: true, motivo_descarte: 'Me falta alguna de las tres' }) });
        api.post.mockResolvedValue({ data: { status: 'success' } });
        render(<HiringCandidateModal applicationId={7} ids={[7]} onClose={vi.fn()} onNavigate={vi.fn()} />);
        await screen.findByText('Ana Pérez');
        expect(screen.getByRole('button', { name: /Seleccionar/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Descartar$/ })).toBeNull();
        screen.getByRole('button', { name: /Pasar a prueba/ }).click();
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assistant-applications/7/estado', { valor: 'testeo', motivo: null }));
    });
});

describe('respuestas a preguntas nuevas del editor', () => {
    it('salen con su enunciado; el puntaje de una de varias opciones no es una tarjeta', async () => {
        api.get.mockResolvedValue({
            data: postulacion({
                respuestas_extra: { extra_ab12cd: 'Trello | ClickUp', extra_ab12cd_pts: 4 },
                preguntas_extra: [{ id: 'extra_ab12cd', t: '¿Qué gestor de tareas usás?', bloque: 'Extra' }],
            }),
        });
        render(<HiringCandidateModal applicationId={7} ids={[7]} onClose={vi.fn()} onNavigate={vi.fn()} />);
        expect(await screen.findByText('¿Qué gestor de tareas usás?')).toBeTruthy();
        expect(screen.getByText('Trello | ClickUp')).toBeTruthy();
        expect(screen.queryByText('extra_ab12cd_pts')).toBeNull();
    });
});

describe('dimensionesPanel', () => {
    it('en un monitor de 1440 x 900 no escala: es el tamaño con el que se diseñó', () => {
        const dim = dimensionesPanel(1440, 900);
        expect(dim.zoom).toBe(1);
        expect(dim.width).toBeGreaterThanOrEqual(1400);
        expect(dim.width * dim.zoom).toBeLessThanOrEqual(1440);
    });

    it('en 1920 x 1080 el panel llega a 1600px de ancho y agranda el contenido', () => {
        const dim = dimensionesPanel(1920, 1080);
        expect(dim.zoom).toBeGreaterThan(1.1);
        expect(Math.round(dim.width * dim.zoom)).toBeGreaterThanOrEqual(1598);
        expect(Math.round(dim.width * dim.zoom)).toBeLessThanOrEqual(1600);
        // nunca más alto que la pantalla
        expect(dim.height * dim.zoom).toBeLessThan(1080);
    });

    it('la escala tiene techo, aunque el monitor sea enorme', () => {
        expect(dimensionesPanel(3840, 2160).zoom).toBeLessThanOrEqual(1.35);
    });

    it('en pantallas chicas o bajas va a pantalla completa, sin escalar', () => {
        expect(dimensionesPanel(600, 900)).toBeNull();
        expect(dimensionesPanel(1366, 680)).toBeNull();
    });
});
