import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import AgendasV2Publica from '../../AgendasV2Publica';
import { linkDeLaClase } from './claseEnVivo';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));

const AHORA = Date.parse('2026-10-20T15:00:00Z');
const EVENTOS = [
    { inicio: '2026-10-13T23:00:00Z', whatsapp: 'https://chat.whatsapp.com/viejo' },
    { inicio: '2026-10-20T14:45:00Z', whatsapp: 'https://chat.whatsapp.com/hoy' },
    { inicio: '2026-10-27T23:00:00Z', whatsapp: 'https://chat.whatsapp.com/proximo' },
];

describe('linkDeLaClase', () => {
    it('es el grupo del primer taller que no terminó', () => {
        expect(linkDeLaClase(EVENTOS, AHORA)).toBe('https://chat.whatsapp.com/hoy');
        expect(linkDeLaClase(EVENTOS, Date.parse('2026-10-20T15:20:00Z'))).toBe('https://chat.whatsapp.com/proximo');
    });

    it('sin talleres por delante, el del último; sin ninguno, vacío', () => {
        expect(linkDeLaClase(EVENTOS, Date.parse('2026-11-30T00:00:00Z'))).toBe('https://chat.whatsapp.com/proximo');
        expect(linkDeLaClase([], AHORA)).toBe('');
        expect(linkDeLaClase(undefined, AHORA)).toBe('');
    });
});

describe('PaginaDescalificados', () => {
    afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

    async function montar() {
        render(
            <MemoryRouter initialEntries={['/agendas-v2/agenda/descalificados']}>
                <Routes><Route path="/agendas-v2/agenda/*" element={<AgendasV2Publica />} /></Routes>
            </MemoryRouter>,
        );
        return screen.findByRole('heading', { level: 1 });
    }

    it('dice el «no», trae los tres pasos y el CTA lleva al grupo del próximo taller', async () => {
        api.get.mockResolvedValue({ data: { eventos: [{ inicio: '2099-01-01T00:00:00Z', whatsapp: 'https://chat.whatsapp.com/abc' }] } });
        const h1 = await montar();
        expect(h1.textContent).toBe('Por ahora noes el momentode trabajarjuntos');
        expect(api.get).toHaveBeenCalledWith('/public/workshops/proximos', expect.anything());
        expect(screen.getByTitle('EARN System — video').getAttribute('src')).toContain('loom.com/embed/4c04b56c7e11427c9cc3bcc9395b3773');
        expect(screen.getByRole('link', { name: 'Abrir la guía' }).getAttribute('href')).toContain('drive.google.com');
        const cta = await screen.findByRole('link', { name: 'Quiero sumarme a la clase' });
        expect(cta.getAttribute('href')).toBe('https://chat.whatsapp.com/abc');
        expect(cta.getAttribute('aria-disabled')).toBe('false');
    });

    it('sin link del taller, el CTA queda deshabilitado', async () => {
        api.get.mockRejectedValue(new Error('red'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await montar();
        const cta = screen.getByText('Quiero sumarme a la clase');
        expect(cta.getAttribute('href')).toBeNull();
        expect(cta.getAttribute('aria-disabled')).toBe('true');
    });

    it('la etapa activa avanza sola y se elige al tocarla', async () => {
        api.get.mockResolvedValue({ data: { eventos: [] } });
        await montar();
        vi.useFakeTimers();
        const activas = () => screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent);
        expect(activas()[0]).toContain('Escaneo');
        fireEvent.click(screen.getAllByRole('button', { name: /Nicho de preguntas/ })[0]);
        // El panel del hero y la lista EARN comparten la etapa activa.
        expect(activas().every((t) => t.includes('Nicho de preguntas'))).toBe(true);
        act(() => { vi.advanceTimersByTime(4000); });
        expect(activas()[0]).toContain('Escaneo');
        act(() => { vi.advanceTimersByTime(4000); });
        expect(activas()[0]).toContain('Apuntes');
    });
});
