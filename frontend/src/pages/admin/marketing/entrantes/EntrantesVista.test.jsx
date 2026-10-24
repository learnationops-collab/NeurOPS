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

    it('cuenta por estado, sin la tarjeta de pendientes por paso', async () => {
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        expect(await screen.findByText('1 ya seguían la cuenta')).toBeInTheDocument();
        expect(screen.getByText('2 sin respuesta', { exact: false })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Pendientes por paso' })).not.toBeInTheDocument();
        expect(screen.getByText('mostrando 4 de 4')).toBeInTheDocument();
    });

    it('muestra la tasa de respuesta: quienes contestaron o ya tienen calificación sobre el total', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/manychat-webhook/entrantes'
            ? { ...DATOS, filas: DATOS.filas.map((f) => ({ ...f, respondio: f.estado !== 'sin_respuesta' })) } : [] }));
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        expect(await screen.findByText('2 de 4 respondieron')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('el lead descalificado después de calificar lo dice y no se corrige a calificado', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/manychat-webhook/entrantes'
            ? { ...DATOS, filas: [persona(1, 'Beto', 'descalificado', '4', { descalificado_despues: true })] } : [] }));
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        fireEvent.click(await screen.findByText('Beto'));
        const ficha = within(await screen.findByLabelText('Historial de Beto'));
        expect(ficha.getByText('Descalificado después de calificar')).toBeInTheDocument();
        fireEvent.click(ficha.getByRole('button', { name: 'Calificado' }));
        expect(api.put).not.toHaveBeenCalled();
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

    it('el historial dice qué pasó: inicio, envío y respuesta (también la pegada al envío), sin «Webhook»', async () => {
        const fila = (id, envio, opcion, calif = 'null') => ({ id, created_at: '2026-10-05T12:00:00Z',
            id_option_send: envio, id_option: opcion, qualification: calif });
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/manychat-webhook/entrantes' ? DATOS : [
            fila(6, '4', '1'), fila(5, '11', '11'), fila(4, '4', '0'), fila(3, '0', '1', 'true'), fila(2, '1', '0'), fila(1, null, null),
        ] }));
        render(<div className="dc-shell"><EntrantesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        fireEvent.click(await screen.findByText('Caro'));
        const ficha = await screen.findByLabelText('Historial de Caro');
        await within(ficha).findByText('Inicio de la automatización');
        const pasos = [...ficha.querySelectorAll('.en-historia-paso')].map((n) => n.textContent);
        expect(pasos).toEqual([
            'Se le mandó Mensaje 4 · respondió Opening', 'Se le mandó Mensaje 11 y respondió', 'Se le mandó Mensaje 4',
            'Respondió Opening', 'Se le mandó Opening',
            'Inicio de la automatización',
        ]);
        expect(within(ficha).queryByText(/Webhook/)).not.toBeInTheDocument();
    });
});
