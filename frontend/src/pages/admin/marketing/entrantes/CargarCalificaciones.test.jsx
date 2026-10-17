import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CargarCalificaciones, { leerRenglones } from './CargarCalificaciones';
import api from '../../../../services/api';

vi.mock('../../../../services/api', () => ({ default: { post: vi.fn() } }));

describe('leerRenglones', () => {
    it('acepta coma, punto y coma o tab, y saltea la cabecera', () => {
        expect(leerRenglones('ig, cualificado\nana.gomez, no\n@beto;yes\n\n123\t1')).toEqual([
            { quien: 'ana.gomez', calificacion: 'no' },
            { quien: '@beto', calificacion: 'yes' },
            { quien: '123', calificacion: '1' },
        ]);
    });
});

describe('CargarCalificaciones', () => {
    beforeEach(() => api.post.mockReset());

    it('primero revisa y después aplica', async () => {
        api.post.mockResolvedValueOnce({ data: { encontrados: 2, por_estado: { calificado: 1, descalificado: 1, sin_dato: 0 },
            no_encontrados: [], cantidad_no_encontrados: 0, invalidas: 0, aplicado: false, cambios: 0 } });
        api.post.mockResolvedValueOnce({ data: { aplicado: true, cambios: 1 } });
        const onAplicado = vi.fn();
        render(<CargarCalificaciones onCerrar={() => {}} onAplicado={onAplicado} />);
        fireEvent.change(screen.getByLabelText('Lista de calificaciones'), { target: { value: 'ana, no\nbeto, yes' } });
        fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
        expect(await screen.findByText(/encontradas/)).toBeInTheDocument();
        expect(api.post).toHaveBeenLastCalledWith('/manychat-webhook/calificaciones', expect.objectContaining({ aplicar: false }));
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 2' }));
        await waitFor(() => expect(onAplicado).toHaveBeenCalled());
        expect(api.post).toHaveBeenLastCalledWith('/manychat-webhook/calificaciones', expect.objectContaining({ aplicar: true }));
    });
});
