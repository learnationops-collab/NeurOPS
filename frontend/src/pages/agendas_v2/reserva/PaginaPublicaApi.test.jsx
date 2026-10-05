// Página pública con la API: pide el evento publicado a /agendas-v2/publico y nunca el estado de gestión.

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { normalEvento, normalForm } from '../core/normalizar';
import PaginaPublica from './PaginaPublica';

vi.mock('../data/modo', () => ({ MODO_LOCAL: false }));
vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const form = normalForm('f1', { nombre: 'Diagnóstico', contacto: { nombre: true, telefono: false, email: false, instagram: false }, preguntas: [] });
const evento = normalEvento('e1', { nombre: 'Llamada de diagnóstico', slug: 'diagnostico', formulario: 'f1', duracion: 45 });

function abrir(ruta) {
    return render(
        <MemoryRouter initialEntries={[ruta]}>
            <Routes>
                <Route path="/agenda/:funnel/:evento" element={<PaginaPublica />} />
                <Route path="/agenda/:evento" element={<PaginaPublica />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('PaginaPublica con la API', () => {
    it('carga el evento publicado y pone el título', async () => {
        api.get.mockResolvedValue({ data: { evento, form, funnel: { nombre: 'Meta', slug: 'meta' } } });
        abrir('/agenda/meta/diagnostico?o=ig');
        expect(await screen.findByRole('heading', { name: '¿Cómo te llamás?' })).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(api.get.mock.calls[0][0]).toBe('/agendas-v2/publico/eventos/meta/diagnostico');
        expect(document.title).toBe('Llamada de diagnóstico');
    });

    it('sin funnel usa la ruta corta; un 404 muestra el aviso', async () => {
        api.get.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404, data: { code: 'no_disponible' } } }));
        abrir('/agenda/no-existe');
        expect(await screen.findByRole('heading', { name: 'Este link no está disponible' })).toBeInTheDocument();
        expect(api.get.mock.calls[0][0]).toBe('/agendas-v2/publico/eventos/no-existe');
    });

    it('sin red lo dice distinto', async () => {
        api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
        abrir('/agenda/meta/diagnostico');
        expect(await screen.findByRole('heading', { name: 'No pudimos abrir la agenda' })).toBeInTheDocument();
    });
});
