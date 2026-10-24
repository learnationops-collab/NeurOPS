import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ConversacionesVista, { unir } from './ConversacionesVista';
import api from '../../../../services/api';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn(() => Promise.resolve({ data: {} })) } }));

const MENSAJES = [
    { id: 1, message_id: '1', title: 'Opening', body: '', category: 'opening', is_active: true },
    { id: 2, message_id: '4', title: 'Cualificacion 3', body: '', category: 'cualificacion', is_active: true },
];
const STATS = { kpis: {}, table: [
    { message_id: '1', total_sends: 100, total_responses: 60, response_rate: 60, leads_generated: 50, disqualified_leads: 10, agendas: 3 },
    { message_id: '11', total_sends: 5, total_responses: 2, response_rate: 40, leads_generated: 0, disqualified_leads: 2, agendas: 0 },
] };

describe('unir', () => {
    it('suma los números que llegaron sin estar en el catálogo', () => {
        const filas = unir(MENSAJES, STATS.table);
        expect(filas.map((f) => [f.message_id, f.configurado])).toEqual([['1', true], ['4', true], ['11', false]]);
    });
});

describe('Marketing › Conversaciones', () => {
    beforeEach(() => {
        window.localStorage.clear();
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/conversational/messages' ? MENSAJES : STATS }));
    });

    it('lista el catálogo con lo enviado y respondido, y da de alta uno sin configurar', async () => {
        render(<div className="dc-shell"><ConversacionesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        expect(await screen.findByText('Opening')).toBeInTheDocument();
        expect(await screen.findByText('Llegó 1 número sin configurar: tocalo para darlo de alta.')).toBeInTheDocument();
        fireEvent.click(screen.getAllByText('Sin configurar')[0]);
        const modal = within(await screen.findByRole('dialog'));
        expect(modal.getByLabelText('Número del mensaje')).toHaveValue('11');
        fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Recurso (no calificado)' } });
        fireEvent.click(modal.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/conversational/messages',
            expect.objectContaining({ message_id: '11', title: 'Recurso (no calificado)', rama: null })));
    });

    it('cada mensaje dice qué calificación marca y se elige al editarlo', async () => {
        // Kerwin, 18/10/2026: recibir «¿Qué quiere mejorar?» deja descalificado si ManyChat no manda el dato.
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/conversational/messages'
            ? [...MENSAJES, { id: 3, message_id: '11', title: '¿Qué quiere mejorar?', body: '', category: 'dolor', rama: 'descalificados', is_active: true }]
            : STATS }));
        render(<div className="dc-shell"><ConversacionesVista desde="2026-10-01" hasta="2026-10-16" /></div>);

        expect(await screen.findByText('Dolor · marca descalificado')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cualificacion 3'));
        const modal = within(await screen.findByRole('dialog'));
        fireEvent.click(modal.getByRole('button', { name: /Marca al lead como/ }));
        fireEvent.click(await screen.findByRole('option', { name: 'Calificado' }));
        expect(modal.getByText('Quien lo reciba queda calificado si ManyChat no mandó la calificación.')).toBeInTheDocument();
        fireEvent.click(modal.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/conversational/messages/2',
            expect.objectContaining({ rama: 'calificados' })));
    });
    it('los nombres se ven apenas llega el catálogo; las cifras esperan su cálculo', async () => {
        let soltar;
        api.get.mockImplementation((url) => (url === '/conversational/messages'
            ? Promise.resolve({ data: MENSAJES })
            : new Promise((r) => { soltar = () => r({ data: STATS }); })));
        render(<div className="dc-shell"><ConversacionesVista desde="2026-10-01" hasta="2026-10-16" /></div>);
        expect(screen.getByRole('status', { name: 'Cargando los mensajes…' })).toBeInTheDocument();
        expect(await screen.findByText('Opening')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Calculando las cifras del período…');
        expect(screen.queryByText('100')).not.toBeInTheDocument();
        soltar();
        expect(await screen.findByText('100')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
