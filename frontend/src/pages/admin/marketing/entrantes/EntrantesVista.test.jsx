import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import EntrantesVista from './EntrantesVista';
import api from '../../../../services/api';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(() => Promise.resolve({ data: {} })), post: vi.fn() } }));

const persona = (id, nombre, estado, enviado, extra = {}) => ({
    lead_id: id, manychat_id: `mc${id}`, nombre, ig: nombre.toLowerCase(), follower: false, setter: 'Ana',
    clave: 'GUIA PERU', campana: 'LM Funnel', conjunto: 'Guía Perú', estado,
    ultimo_enviado: { id: enviado, titulo: enviado === '1' ? 'Opening' : 'Cualificacion 3', categoria: enviado === '1' ? 'opening' : 'cualificacion' },
    ultimo_respondido: { id: null, titulo: null, categoria: null },
    interacciones: 2, primera_at: '2026-10-05T12:00:00Z', ultima_at: `2026-10-05T12:0${id}:00Z`, ...extra,
});

const DATOS = {
    desde: '2026-10-01', hasta: '2026-10-16', mensajes: { 1: { titulo: 'Opening', categoria: 'opening' } },
    filas: [
        persona(1, 'Beto', 'calificado', '4', { follower: true }),
        persona(2, 'Caro', 'sin_respuesta', '1'),
        persona(3, 'Dani', 'sin_respuesta', '1'),
        persona(4, 'Eli', 'en_conversacion', '4'),
    ],
};

describe('Marketing › Entrantes', () => {
    beforeEach(() => {
        window.localStorage.clear();
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/manychat-webhook/entrantes'
            ? DATOS : [{ id: 9, created_at: '2026-10-05T12:00:00Z', id_option_send: '1', id_option: '0', qualification: 'null' }] }));
    });

    it('cuenta por estado y muestra dónde quedaron los pendientes', async () => {
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        const pasos = within(await screen.findByRole('region', { name: 'Pendientes por paso' }));
        expect(pasos.getByText('Opening')).toBeInTheDocument();
        expect(pasos.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('1 ya seguían la cuenta')).toBeInTheDocument();
        expect(screen.getByText('mostrando 4 de 4')).toBeInTheDocument();
    });

    it('desde la ficha se corrige la calificación', async () => {
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        fireEvent.click(await screen.findByText('Beto'));
        const ficha = within(await screen.findByLabelText('Historial de Beto'));
        fireEvent.click(ficha.getByRole('button', { name: 'Descalificado' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/manychat-webhook/lead/1/calificacion', { estado: 'descalificado' }));
        expect(await ficha.findAllByText('Descalificado')).not.toHaveLength(0);
    });

    it('la fila abre el historial de la persona', async () => {
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        fireEvent.click(await screen.findByText('Caro'));
        const ficha = within(await screen.findByLabelText('Historial de Caro'));
        expect(await ficha.findByText('Opening')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/manychat-webhook/log', expect.objectContaining({
            params: { lead_id: 2, limit: 200 } }));
    });
});
