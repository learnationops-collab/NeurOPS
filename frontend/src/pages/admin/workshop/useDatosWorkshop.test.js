import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import api from '../../../services/api';
import useDatosWorkshop from './useDatosWorkshop';

// Un pedido por ruta que se resuelve a mano: así se ve qué llena cada respuesta.
const pendientes = () => {
    const abiertos = {};
    api.get.mockImplementation((ruta) => new Promise((resolve, reject) => {
        (abiertos[ruta] ||= []).push({ resolve, reject });
    }));
    return {
        responder: (ruta, data) => act(async () => { abiertos[ruta].shift().resolve({ data }); }),
        fallar: (ruta) => act(async () => { abiertos[ruta].shift().reject(new Error('caído')); }),
        cuantos: (ruta) => abiertos[ruta]?.length || 0,
    };
};

describe('useDatosWorkshop', () => {
    afterEach(() => { vi.clearAllMocks(); });

    it('pide los tres a la vez y cada uno llena SU dato apenas llega', async () => {
        const p = pendientes();
        const { result } = renderHook(() => useDatosWorkshop());
        expect(api.get.mock.calls.map(([r]) => r)).toEqual(['workshop/events', 'workshop/goals', 'workshop/actions']);
        expect(result.current.events).toBeNull();

        await p.responder('workshop/goals', { meta_whatsapp: 70 });
        expect(result.current.goals).toEqual({ meta_whatsapp: 70 });
        expect(result.current.events).toBeNull();

        await p.responder('workshop/events', [{ id: 1 }]);
        expect(result.current.events).toEqual([{ id: 1 }]);
        expect(result.current.actions).toBeNull();
    });

    it('recargar deja lo que se ve hasta que llega lo nuevo', async () => {
        const p = pendientes();
        const { result } = renderHook(() => useDatosWorkshop());
        await p.responder('workshop/events', [{ id: 1 }]);
        await p.responder('workshop/goals', {});
        await p.responder('workshop/actions', []);

        let recarga;
        act(() => { recarga = result.current.recargar(); });
        expect(result.current.recargando).toBe(true);
        expect(result.current.events).toEqual([{ id: 1 }]);

        await p.responder('workshop/events', [{ id: 1 }, { id: 2 }]);
        await p.responder('workshop/goals', {});
        await p.responder('workshop/actions', []);
        await act(async () => { await recarga; });
        expect(result.current.events).toHaveLength(2);
        expect(result.current.recargando).toBe(false);
    });

    it('si la primera carga falla lo marca, para ofrecer reintentar en vez de un esqueleto eterno', async () => {
        const p = pendientes();
        const { result } = renderHook(() => useDatosWorkshop());
        await p.fallar('workshop/events');
        expect(result.current.fallas.events).toBe(true);
        expect(result.current.events).toBeNull();

        act(() => { result.current.fetchEvents(); });
        await waitFor(() => expect(p.cuantos('workshop/events')).toBe(1));
        await p.responder('workshop/events', []);
        expect(result.current.fallas.events).toBe(false);
        expect(result.current.events).toEqual([]);
    });
});
